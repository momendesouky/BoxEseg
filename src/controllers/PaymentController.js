const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const container = require('../config/container');
const logger = require('../utils/logger');

exports.paymobWebhook = catchAsync(async (req, res) => {
  const payload = { ...req.body, ...req.query };

  if (payload.hmac && !container.paymentService.verifyPaymobHmac(payload)) {
    logger.error('Paymob webhook: HMAC verification failed');
    throw new AppError('Invalid Paymob webhook signature.', 401);
  }

  const result = await container.orderService.handlePaymobWebhook(payload);
  logger.info(`Paymob webhook: processed for order ${result?.orderNumber || 'unknown'}`);
  res.status(200).json({ status: 'success' });
});

exports.paymobCallback = catchAsync(async (req, res) => {
  const rawSuccess = req.query.success;
  const success = String(rawSuccess).toLowerCase() === 'true';
  const orderNumber = req.session.pendingPaymentOrder;

  logger.info(`Paymob callback: raw_success="${rawSuccess}" parsed=${success} orderNumber=${orderNumber || 'none'} all_query=${JSON.stringify(req.query)} logged_in=${!!req.currentUser}`);

  if (success && orderNumber) {
    try {
      await container.orderService.confirmPayment(orderNumber, req.query.id);
      logger.info(`Paymob callback: order ${orderNumber} confirmed`);
    } catch (err) {
      logger.error(`Paymob callback: confirmPayment failed for ${orderNumber}: ${err.message}`);
    }
  } else if (!orderNumber) {
    logger.warn('Paymob callback: no pendingPaymentOrder in session');
  } else {
    logger.warn(`Paymob callback: payment not successful`);
  }

  delete req.session.pendingPaymentOrder;

  if (success && req.currentUser) {
    req.flash('success', 'Payment received successfully.');
    return res.redirect('/orders');
  }

  if (success && !req.currentUser) {
    req.flash('success', 'Payment received successfully. Please sign in to view your order.');
    return res.redirect(`/auth/login?next=${encodeURIComponent('/orders')}`);
  }

  req.flash('error', 'Payment was not completed.');
  res.redirect('/checkout');
});

exports.walletPage = catchAsync(async (req, res) => {
  const orderNumber = req.session.pendingPaymentOrder;
  if (!orderNumber) {
    req.flash('error', 'No pending payment found. Please try again.');
    return res.redirect('/checkout');
  }
  res.render('payments/wallet', { title: 'Mobile Wallet Payment', orderNumber });
});

exports.paymentStatus = catchAsync(async (req, res) => {
  const order = await container.orderRepository.findByOrderNumber(req.params.orderNumber);
  if (!order) return res.json({ paymentStatus: 'unknown' });
  res.json({ paymentStatus: order.payment?.status || 'pending' });
});

const fs = require('fs');
const path = require('path');
function walletDebug(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(__dirname, '..', '..', 'wallet-debug.log'), line);
}

exports.walletPay = catchAsync(async (req, res) => {
  const orderNumber = req.session.pendingPaymentOrder;
  walletDebug(`walletPay HIT — orderNumber=${orderNumber}, walletNumber=${req.body.walletNumber}, sessionID=${req.sessionID}`);

  if (!orderNumber) {
    walletDebug('ABORT: no pendingPaymentOrder in session');
    req.flash('error', 'No pending payment found. Please start checkout again.');
    return res.redirect('/checkout');
  }

  const { walletNumber } = req.body;
  if (!walletNumber || walletNumber.trim().length < 10) {
    walletDebug(`ABORT: walletNumber invalid — "${walletNumber}"`);
    req.flash('error', 'Please enter a valid wallet phone number.');
    return res.redirect('/payments/wallet');
  }

  const order = await container.orderRepository.findByOrderNumber(orderNumber);
  if (!order) {
    walletDebug(`ABORT: order ${orderNumber} not found in DB`);
    req.flash('error', 'Order not found.');
    return res.redirect('/checkout');
  }
  walletDebug(`Order found: id=${order.id}, status=${order.status}, paymentStatus=${order.payment?.status}, walletToken=${order.payment?.walletToken ? 'present' : 'missing'}`);

  let paymobData;
  try {
    walletDebug('Calling createAndPayWallet...');
    paymobData = await container.paymentService.createAndPayWallet(order, walletNumber.trim());
    walletDebug(`createAndPayWallet SUCCESS — paymobData=${JSON.stringify(paymobData).substring(0, 500)}`);
  } catch (err) {
    walletDebug(`ABORT: createAndPayWallet threw — ${err.message}`);
    req.flash('error', 'Wallet payment could not be initiated: ' + err.message);
    return res.redirect('/payments/wallet');
  }

  if (paymobData.id) {
    try {
      await container.orderRepository.updateById(order.id, {
        payment: { ...order.payment, paymobTransactionId: String(paymobData.id) },
      });
      walletDebug('Saved paymobTransactionId to order');
    } catch (e) {
      walletDebug(`WARN: failed to save transaction ID — ${e.message}`);
    }
  }

  const redirectUrl = paymobData.redirect_url || paymobData.data?.redirect_url;
  walletDebug(`redirectUrl=${redirectUrl || '(none)'}`);

  if (redirectUrl) {
    walletDebug(`RENDERING wallet-redirect page → ${redirectUrl}`);
    return res.render('payments/wallet-redirect', {
      title: 'Redirecting to Wallet Payment…',
      redirectUrl,
    });
  }

  walletDebug(`RENDERING wallet-waiting page`);
  res.render('payments/wallet-waiting', {
    title: 'Complete Wallet Payment',
    orderNumber,
    orderId: order.id,
    transactionId: paymobData.id || null,
    walletNumber: walletNumber.trim(),
  });
});
