const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const summary = await container.dashboardService.summary();
  res.render('dashboard/index', { title: 'Dashboard', summary });
});

exports.users = catchAsync(async (req, res) => {
  const { users, pagination } = await container.userService.list(req.query);
  res.render('dashboard/users/index', { title: 'Users', users, pagination });
});

exports.updateUser = catchAsync(async (req, res) => {
  await container.userService.updateUserStatus(req.params.id, req.body);
  req.flash('success', 'User updated.');
  res.redirect('/dashboard/users');
});

exports.inventory = catchAsync(async (req, res) => {
  const inventory = await container.dashboardService.inventory(req.query);
  res.render('dashboard/inventory/index', { title: 'Inventory', inventory });
});

exports.reports = catchAsync(async (req, res) => {
  const report = await container.dashboardService.reports();
  res.render('dashboard/reports/index', { title: 'Reports', report });
});
