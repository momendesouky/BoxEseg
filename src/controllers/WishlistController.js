const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const wishlist = await container.wishlistService.getWishlist(req.currentUser.id);
  res.render('wishlist/index', { title: 'Wishlist', wishlist });
});

exports.add = catchAsync(async (req, res) => {
  await container.wishlistService.add(req.currentUser.id, req.params.productId);
  req.flash('success', 'Saved to wishlist.');
  res.redirect(req.get('referer') || '/wishlist');
});

exports.remove = catchAsync(async (req, res) => {
  await container.wishlistService.remove(req.currentUser.id, req.params.productId);
  req.flash('success', 'Removed from wishlist.');
  res.redirect(req.get('referer') || '/wishlist');
});
