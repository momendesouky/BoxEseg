const crypto = require('crypto');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const container = require('../config/container');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

// ── helpers ──────────────────────────────────────────────────────────────

function contactFromPayload(req) {
  // SMS is gone from the UI — phone identities deliver via Telegram instead.
  if (req.body.contactMethod === 'telegram') {
    const normalized = container.smsService.normalize(req.body.phone);
    if (!normalized || normalized.length < 10) {
      throw new AppError('Enter a valid Egyptian mobile number (e.g. 01012345678).', 400);
    }
    return { type: 'phone', value: normalized, method: 'telegram' };
  }

  return { type: 'email', value: req.body.email.toLowerCase().trim(), method: 'email' };
}

// One-time code the guest sends to our Telegram bot to link their chat.
// Confusable glyphs (O/0, I/1) are left out of the alphabet.
function generateLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) code += alphabet[crypto.randomInt(0, alphabet.length)];
  return code;
}

function setOtpChallenge(session, contact, purpose) {
  const channel = contact.method === 'telegram' ? 'telegram' : (contact.type === 'email' ? 'email' : 'sms');
  session.otpChallenge = {
    contactType: contact.type,
    contact: contact.value,
    purpose,
    channel,
    ...(channel === 'telegram' ? { linkCode: generateLinkCode(), telegramChatId: null } : {}),
  };
}

function telegramEnabled() {
  return container.telegramService.isConfigured();
}

/**
 * Telegram fast path: delivers the OTP straight to a chat linked earlier for
 * this same phone number (stored in the telegramContacts collection). Returns
 * true when delivered; false means the guest still has to link (or relink) by
 * sending the on-screen link code to the bot. Cooldown errors propagate.
 */
async function deliverViaLinkedChat(req) {
  const challenge = req.session.otpChallenge;
  const known = await container.telegramContactRepository.findByPhone(challenge.contact).catch(() => null);
  if (!known || !known.chatId) return false;

  try {
    await container.otpService.sendOtp({
      contactType: challenge.contactType,
      contact: challenge.contact,
      purpose: challenge.purpose,
      channel: 'telegram',
      telegramChatId: known.chatId,
    });
  } catch (err) {
    if (err.statusCode === 429) throw err; // resend cooldown — handled as a flash by callers
    // The stored chat is unreachable (bot blocked/deleted) — fall back to linking.
    await container.telegramContactRepository.remove(challenge.contact).catch(() => {});
    return false;
  }

  challenge.telegramChatId = known.chatId;
  return true;
}

function requireOtpChallenge(req) {
  const challenge = req.session.otpChallenge;
  if (!challenge) {
    throw new AppError('Verification session expired. Please try again.', 400);
  }
  return challenge;
}

function setGuestIdentity(session, verification) {
  session.guestIdentity = {
    contactType: verification.contactType,
    contact: verification.contact,
    verifiedAt: verification.verifiedAt,
    // Auto sign-out for tracking even if the guest never exits explicitly.
    expiresAt: new Date(Date.now() + env.tracking.sessionMinutes * 60 * 1000),
  };
}

// Old identities created before expiry existed fall back to verifiedAt.
function identityExpired(identity) {
  const endsAt = identity.expiresAt
    ? new Date(identity.expiresAt).getTime()
    : new Date(identity.verifiedAt).getTime() + env.tracking.sessionMinutes * 60 * 1000;
  return endsAt <= Date.now();
}

/**
 * Gate for tracking pages. Returns the active identity, or null after
 * clearing an expired one (with a flash so the guest knows why). It supports
 * a sliding window: each page view pushes expiry out again, so guests are
 * signed out after `<sessionMinutes>` of inactivity, not of absolute time.
 */
function requireActiveIdentity(req, res) {
  const identity = req.session.guestIdentity;
  if (!identity) return null;

  if (identityExpired(identity)) {
    delete req.session.guestIdentity;
    req.flash('error', 'Your tracking session timed out after a period of inactivity. Verify your contact again to view orders.');
    res.locals.identityTimedOut = true;
    return null;
  }

  // Sliding window: this page view restarts the countdown.
  identity.expiresAt = new Date(Date.now() + env.tracking.sessionMinutes * 60 * 1000);
  return identity;
}

function checkoutDraftFromSession(req) {
  const session = req.session;
  const draft = session.guestCheckoutDraft;
  const guestCart = session.guestCart;

  if (!draft || !guestCart || !guestCart.items.length) {
    return null;
  }

  return {
    contactType: draft.contactType,
    contact: draft.contact,
    paymentMethod: draft.paymentMethod,
    ...draft.address,
    items: guestCart.items.map((entry) => ({
      productId: entry.productId,
      quantity: entry.quantity,
      cutNotes: entry.cutNotes || '',
    })),
    couponCode: guestCart.couponCode || null,
  };
}

// Same redirect contract as CheckoutController.checkout — paymob flows stash
// the order in the session; COD goes straight to the guest order page.
function redirectToOrder(req, res, order) {
  if (order.payment?.walletToken) {
    req.session.pendingPaymentOrder = order.orderNumber;
    req.session.save(() => res.redirect('/payments/wallet'));
    return;
  }

  if (order.payment?.iframeUrl) {
    req.session.pendingPaymentOrder = order.orderNumber;
    req.session.save(() => res.redirect(order.payment.iframeUrl));
    return;
  }

  req.flash('success', 'Order placed successfully.');
  res.redirect(`/orders/guest/${order.orderNumber}`);
}

function maskContact(contactType, contact) {
  return container.otpService.mask(contact, contactType);
}

// ── guest checkout (contact + verification before order) ─────────────────

exports.checkoutIndex = catchAsync(async (req, res) => {
  const { cart, totals } = await container.cartService.buildGuestCartView(req.session);
  res.render('checkout/index', {
    title: 'Checkout',
    cart,
    totals,
    draft: req.session.guestCheckoutDraft || null,
    telegramEnabled: telegramEnabled(),
  });
});

exports.startCheckout = catchAsync(async (req, res) => {
  if (!req.session.guestCart || !req.session.guestCart.items.length) {
    req.flash('error', 'Your cart is empty. Add some products first.');
    return res.redirect('/cart');
  }

  const contact = contactFromPayload(req);

  // Stash the full checkout (address + payment) in the session; the verified
  // OTP contact unlocks order creation.
  req.session.guestCheckoutDraft = {
    contactType: contact.type,
    contact: contact.value,
    contactMethod: contact.method,
    address: {
      fullName: req.body.fullName,
      phone: req.body.phone,
      city: req.body.city,
      area: req.body.area,
      street: req.body.street,
      building: req.body.building,
      notes: req.body.notes,
    },
    paymentMethod: req.body.paymentMethod,
  };

  setOtpChallenge(req.session, contact, 'checkout');

  // Telegram delivery. Returning guests (phone linked before) get the code
  // right away; first-timers walk through the bot-link step on the verify page.
  if (contact.method === 'telegram') {
    if (!telegramEnabled()) {
      req.flash('error', 'Delivery via Telegram is not available right now. Please choose email or SMS.');
      return res.redirect('/checkout');
    }
    try {
      await deliverViaLinkedChat(req);
    } catch (err) {
      req.flash('error', err.statusCode && err.statusCode < 500 ? err.message : 'Could not send the verification code. Please try again in a moment.');
      return res.redirect('/checkout');
    }
    return req.session.save(() => res.redirect('/checkout/guest/verify'));
  }

  try {
    await container.otpService.sendOtp({
      contactType: contact.type,
      contact: contact.value,
      purpose: 'checkout',
    });
  } catch (err) {
    // Cooldown/delivery issues: keep the draft so the form is repopulated.
    req.flash('error', err.statusCode && err.statusCode < 500 ? err.message : 'Could not send the verification code. Please try again in a moment.');
    return res.redirect('/checkout');
  }

  req.session.save(() => res.redirect('/checkout/guest/verify'));
});

// ── shared OTP step (checkout verification + guest tracking login) ────────

exports.showVerify = catchAsync(async (req, res) => {
  const challenge = requireOtpChallenge(req);
  const isTelegram = challenge.channel === 'telegram';
  const botUsername = isTelegram ? await container.telegramService.getBotUsername() : null;
  res.render('otp/verify', {
    title: 'Verification code',
    maskedContact: maskContact(challenge.contactType, challenge.contact),
    contactType: challenge.contactType,
    purpose: challenge.purpose,
    channel: challenge.channel || (challenge.contactType === 'email' ? 'email' : 'sms'),
    telegramLinked: Boolean(challenge.telegramChatId),
    linkCode: challenge.linkCode || null,
    botUsername,
  });
});

// Polled by otp/verify.ejs while the guest links their Telegram chat.
// JSON contract: { status: 'sent' | 'waiting' | 'error', message? }
exports.telegramStatus = catchAsync(async (req, res) => {
  const challenge = req.session.otpChallenge;

  if (
    !challenge ||
    challenge.channel !== 'telegram' ||
    !challenge.linkCode ||
    String(req.query.code || '').toUpperCase() !== challenge.linkCode
  ) {
    return res.status(400).json({ status: 'error', message: 'Verification session expired. Please start again.' });
  }

  if (challenge.telegramChatId) {
    return res.json({ status: 'sent' });
  }

  const chat = await container.telegramService.waitForChat(challenge.linkCode, 11000);
  if (!chat) {
    return res.json({ status: 'waiting' });
  }

  try {
    await container.otpService.sendOtp({
      contactType: challenge.contactType,
      contact: challenge.contact,
      purpose: challenge.purpose,
      channel: 'telegram',
      telegramChatId: chat.chatId,
    });
  } catch (err) {
    // Cooldown / delivery hiccups surface as a gentle message, not a 500.
    return res.json({
      status: 'error',
      message: err.statusCode && err.statusCode < 500
        ? err.message
        : 'Could not send the code to Telegram. Please try again.',
    });
  }

  challenge.telegramChatId = chat.chatId;

  // Remember phone → chat so the next code for this number is sent instantly.
  await container.telegramContactRepository
    .upsert(challenge.contact, String(chat.chatId), chat.firstName || '')
    .catch(() => {});

  return req.session.save(() => res.json({ status: 'sent' }));
});

exports.verify = catchAsync(async (req, res) => {
  const challenge = requireOtpChallenge(req);

  let verification;
  try {
    verification = await container.otpService.verifyOtp({
      contactType: challenge.contactType,
      contact: challenge.contact,
      purpose: challenge.purpose,
      code: req.body.code,
    });
  } catch (err) {
    // Wrong/expired codes and exhausted attempts go back to the code input
    // with a flash instead of the generic error page.
    if (err.statusCode && err.statusCode < 500) {
      const isCheckout = challenge.purpose === 'checkout';
      req.flash('error', err.message.replace(/\.$/, '') + '.');
      return res.redirect(isCheckout ? '/checkout/guest/verify' : '/orders/guest/verify');
    }
    throw err;
  }


  setGuestIdentity(req.session, verification);

  if (challenge.purpose === 'checkout') {
    const draft = checkoutDraftFromSession(req);
    if (!draft) {
      delete req.session.guestCheckoutDraft;
      delete req.session.otpChallenge;
      req.flash('error', 'Your cart changed while verifying. Please review your cart and try again.');
      return res.redirect('/cart');
    }

    const order = await container.orderService.checkoutGuest(
      { type: verification.contactType, value: verification.contact },
      draft,
      // Free order confirmation in the linked Telegram chat (when used).
      { telegramChatId: challenge.channel === 'telegram' ? challenge.telegramChatId : null }
    );

    delete req.session.guestCheckoutDraft;
    delete req.session.otpChallenge;
    delete req.session.guestCart;

    return redirectToOrder(req, res, order);
  }

  // purpose === 'track' → back to the guest order list
  delete req.session.otpChallenge;
  return res.redirect('/orders/guest');
});

exports.resend = catchAsync(async (req, res) => {
  const challenge = requireOtpChallenge(req);

  // Telegram before linking: there is nothing to resend — the guest still has
  // to message the bot the link code shown on the page.
  if (challenge.channel === 'telegram' && !challenge.telegramChatId) {
    req.flash('error', 'Open the BoxEseg bot in Telegram and send it the code shown on this page first.');
    return res.redirect(challenge.purpose === 'checkout' ? '/checkout/guest/verify' : '/orders/guest/verify');
  }

  try {
    await container.otpService.sendOtp({
      contactType: challenge.contactType,
      contact: challenge.contact,
      purpose: challenge.purpose,
      channel: challenge.channel,
      telegramChatId: challenge.telegramChatId,
    });
    req.flash('success', challenge.channel === 'telegram' ? 'A new code was sent to your Telegram chat.' : 'A new code was sent.');
  } catch (err) {
    // Cooldown (429) or delivery hiccups get a gentle flash, not an error page.
    req.flash('error', err.statusCode ? err.message : 'Could not send a new code right now. Please try again shortly.');
  }
  return res.redirect(challenge.purpose === 'checkout' ? '/checkout/guest/verify' : '/orders/guest/verify');
});

// ── guest order tracking (OTP is the "guest login") ──────────────────────

exports.trackIndex = catchAsync(async (req, res) => {
  const identity = requireActiveIdentity(req, res);

  if (!identity) {
    return res.render('orders/guest-lookup', {
      title: 'Track your orders',
      telegramEnabled: telegramEnabled(),
      identityTimedOut: res.locals.identityTimedOut === true,
    });
  }

  const { page, limit, skip } = getPagination(req.query);
  const [orders, total] = await Promise.all([
    container.orderRepository.listForGuest(identity.contactType, identity.contact, { skip, limit }),
    container.orderRepository.countForGuest(identity.contactType, identity.contact),
  ]);

  res.render('orders/guest-index', {
    title: 'Your orders',
    orders,
    identity,
    maskedContact: maskContact(identity.contactType, identity.contact),
    pagination: buildPaginationMeta({ page, limit, total }),
    trackingMinutes: env.tracking.sessionMinutes,
  });
});

exports.trackLookup = catchAsync(async (req, res) => {
  const raw = req.body.contact.trim();
  const isEmail = raw.includes('@');
  let contact;
  let contactType;

  try {
    if (isEmail) {
      contactType = 'email';
      contact = raw.toLowerCase();
    } else {
      contactType = 'phone';
      contact = container.smsService.normalize(raw);
      if (!contact || contact.length < 10) {
        throw new Error();
      }
    }
  } catch (_) {
    throw new AppError(
      isEmail
        ? 'Enter a valid email address.'
        : 'Enter a valid Egyptian mobile number (e.g. 01012345678).',
      400
    );
  }

  // Phone identities deliver through Telegram (SMS removed from the flow).
  if (contactType === 'phone' && !telegramEnabled()) {
    req.flash('error', 'Telegram is not set up right now. Please enter your email instead.');
    return res.redirect('/orders/guest');
  }

  setOtpChallenge(
    req.session,
    { type: contactType, value: contact, method: contactType === 'phone' ? 'telegram' : 'email' },
    'track'
  );

  if (contactType === 'phone') {
    try {
      await deliverViaLinkedChat(req);
    } catch (err) {
      req.flash('error', err.statusCode && err.statusCode < 500 ? err.message : 'Could not send the verification code. Please try again in a moment.');
      return res.redirect('/orders/guest');
    }
    // Delivered instantly (returning guest) or link step on the verify page.
    return req.session.save(() => res.redirect('/orders/guest/verify'));
  }

  try {
    await container.otpService.sendOtp({ contactType, contact, purpose: 'track' });
  } catch (err) {
    req.flash('error', err.statusCode && err.statusCode < 500 ? err.message : 'Could not send the verification code. Please try again in a moment.');
    return res.redirect('/orders/guest');
  }

  req.session.save(() => res.redirect('/orders/guest/verify'));
});

exports.trackLogout = (req, res) => {
  delete req.session.guestIdentity;
  req.flash('success', 'Signed out of guest order tracking.');
  return res.redirect('/orders/guest');
};

exports.trackShow = catchAsync(async (req, res) => {
  const identity = requireActiveIdentity(req, res);

  if (!identity) {
    if (res.locals.identityTimedOut === true) {
      return res.redirect('/orders/guest');
    }
    return res.render('orders/guest-lookup', { title: 'Track your orders', telegramEnabled: telegramEnabled() });
  }

  const order = await container.orderRepository.findForGuestOrderNumber(
    req.params.orderNumber,
    identity.contactType,
    identity.contact
  );

  if (!order) {
    throw new AppError('Order not found for this contact.', 404);
  }

  res.render('orders/guest-show', { title: `Order ${order.orderNumber}`, order });
});
