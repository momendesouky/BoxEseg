const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.adminIndex = catchAsync(async (req, res) => {
  const { coupons, pagination } = await container.couponService.list(req.query);
  res.render('dashboard/coupons/index', { title: 'Coupons', coupons, pagination });
});

exports.adminCreate = catchAsync(async (req, res) => {
  await container.couponService.create(req.body);
  req.flash('success', 'Coupon created.');
  res.redirect('/dashboard/coupons');
});

exports.adminUpdate = catchAsync(async (req, res) => {
  await container.couponService.update(req.params.id, req.body);
  req.flash('success', 'Coupon updated.');
  res.redirect('/dashboard/coupons');
});
