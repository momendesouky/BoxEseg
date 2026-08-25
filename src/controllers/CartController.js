const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const { cart, totals } = await container.cartService.getCart(req.currentUser.id);
  res.render('cart/index', { title: 'Cart', cart, totals });
});

exports.addItem = catchAsync(async (req, res) => {
  await container.cartService.addItem(req.currentUser.id, req.body);
  req.flash('success', 'Product added to cart.');
  res.redirect(req.get('referer') || '/cart');
});

exports.updateItem = catchAsync(async (req, res) => {
  await container.cartService.updateItem(req.currentUser.id, req.params.productId, req.body.quantity);
  req.flash('success', 'Cart updated.');
  res.redirect('/cart');
});

exports.removeItem = catchAsync(async (req, res) => {
  await container.cartService.removeItem(req.currentUser.id, req.params.productId);
  req.flash('success', 'Product removed from cart.');
  res.redirect('/cart');
});

exports.applyCoupon = catchAsync(async (req, res) => {
  await container.cartService.applyCoupon(req.currentUser.id, req.body.code);
  req.flash('success', 'Coupon applied.');
  res.redirect('/cart');
});

exports.removeCoupon = catchAsync(async (req, res) => {
  await container.cartService.removeCoupon(req.currentUser.id);
  req.flash('success', 'Coupon removed.');
  res.redirect('/cart');
});
