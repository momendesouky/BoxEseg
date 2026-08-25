const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.create = catchAsync(async (req, res) => {
  await container.reviewService.create(req.currentUser.id, req.params.productId, req.body);
  req.flash('success', 'Thanks for reviewing this product.');
  res.redirect(req.get('referer') || '/products');
});
