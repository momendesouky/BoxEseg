const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

// Both signed-in (DB cart) and guest (session cart) flows produce the same
// `{ cart, totals }` shape, so the views are shared unchanged.

exports.index = catchAsync(async (req, res) => {
  const { cart, totals } = req.currentUser
    ? await container.cartService.getCart(req.currentUser.id)
    : await container.cartService.buildGuestCartView(req.session);
  res.render('cart/index', { title: 'Cart', cart, totals });
});

exports.addItem = catchAsync(async (req, res) => {
  if (req.currentUser) {
    await container.cartService.addItem(req.currentUser.id, req.body);
  } else {
    await container.cartService.addGuestItem(req.session, req.body);
  }
  req.flash('success', 'Product added to cart.');
  res.redirect(req.get('referer') || '/cart');
});

exports.updateItem = catchAsync(async (req, res) => {
  if (req.currentUser) {
    await container.cartService.updateItem(req.currentUser.id, req.params.productId, req.body.quantity);
  } else {
    await container.cartService.updateGuestItem(req.session, req.params.productId, req.body.quantity);
  }
  req.flash('success', 'Cart updated.');
  res.redirect('/cart');
});

exports.removeItem = catchAsync(async (req, res) => {
  if (req.currentUser) {
    await container.cartService.removeItem(req.currentUser.id, req.params.productId);
  } else {
    await container.cartService.removeGuestItem(req.session, req.params.productId);
  }
  req.flash('success', 'Product removed from cart.');
  res.redirect('/cart');
});

exports.applyCoupon = catchAsync(async (req, res) => {
  if (req.currentUser) {
    await container.cartService.applyCoupon(req.currentUser.id, req.body.code);
  } else {
    await container.cartService.applyGuestCoupon(req.session, req.body.code);
  }
  req.flash('success', 'Coupon applied.');
  res.redirect('/cart');
});

exports.removeCoupon = catchAsync(async (req, res) => {
  if (req.currentUser) {
    await container.cartService.removeCoupon(req.currentUser.id);
  } else {
    await container.cartService.removeGuestCoupon(req.session);
  }
  req.flash('success', 'Coupon removed.');
  res.redirect('/cart');
});
