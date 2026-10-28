const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');
const guestController = require('./GuestController');

exports.index = catchAsync(async (req, res) => {
  if (!req.currentUser) {
    // Guests: session cart + contact-verification form (same view file).
    return guestController.checkoutIndex(req, res);
  }
  const { cart, totals } = await container.cartService.getCart(req.currentUser.id);
  res.render('checkout/index', { title: 'Checkout', cart, totals, draft: null });
});

exports.checkout = catchAsync(async (req, res) => {
  const order = await container.orderService.checkout(req.currentUser, req.body);

  if (req.body.paymentMethod === 'paymob_wallet' && order.payment?.walletToken) {
    req.session.pendingPaymentOrder = order.orderNumber;
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.redirect('/payments/wallet');
  }

  if (order.payment?.iframeUrl) {
    req.session.pendingPaymentOrder = order.orderNumber;
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.redirect(order.payment.iframeUrl);
  }

  req.flash('success', 'Order placed successfully.');
  return res.redirect(`/orders/${order.id}`);
});
