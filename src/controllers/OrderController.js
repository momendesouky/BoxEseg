const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const { orders, pagination } = await container.orderService.listForUser(req.currentUser.id, req.query);
  res.render('orders/index', { title: 'Orders', orders, pagination });
});

exports.show = catchAsync(async (req, res) => {
  const order = await container.orderService.findForUser(req.params.id, req.currentUser.id);
  res.render('orders/show', { title: `Order ${order.orderNumber}`, order });
});

exports.invoice = catchAsync(async (req, res) => {
  const order = await container.orderService.findForUser(req.params.id, req.currentUser.id);
  if (!order.invoice?.path) {
    req.flash('warning', 'Invoice is still being prepared.');
    return res.redirect(`/orders/${order.id}`);
  }

  return res.redirect(order.invoice.path);
});

exports.adminIndex = catchAsync(async (req, res) => {
  const { orders, pagination } = await container.orderService.listForAdmin(req.query);
  res.render('dashboard/orders/index', { title: 'Manage orders', orders, pagination });
});

exports.adminShow = catchAsync(async (req, res) => {
  const order = await container.orderService.findById(req.params.id);
  res.render('dashboard/orders/show', { title: `Order ${order.orderNumber}`, order });
});

exports.adminUpdate = catchAsync(async (req, res) => {
  await container.orderService.updateStatus(req.params.id, req.body);
  req.flash('success', 'Order updated.');
  res.redirect(`/dashboard/orders/${req.params.id}`);
});
