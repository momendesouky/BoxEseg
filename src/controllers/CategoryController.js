const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.adminIndex = catchAsync(async (req, res) => {
  const { categories, pagination } = await container.categoryService.listForAdmin(req.query);

  res.render('dashboard/categories/index', {
    title: 'Manage categories',
    categories,
    pagination,
  });
});

exports.adminCreateForm = (req, res) => {
  res.render('dashboard/categories/form', {
    title: 'New category',
    category: null,
    action: '/dashboard/categories',
    method: 'POST',
  });
};

exports.adminCreate = catchAsync(async (req, res) => {
  const image = (await container.uploadService.uploadImages(req.files || []))[0];
  await container.categoryService.create({ ...req.body, image });
  req.flash('success', 'Category created.');
  res.redirect('/dashboard/categories');
});

exports.adminEditForm = catchAsync(async (req, res) => {
  const category = await container.categoryService.findById(req.params.id);

  res.render('dashboard/categories/form', {
    title: `Edit ${category.name}`,
    category,
    action: `/dashboard/categories/${category.id}?_method=PUT`,
    method: 'POST',
  });
});

exports.adminUpdate = catchAsync(async (req, res) => {
  const image = (await container.uploadService.uploadImages(req.files || []))[0];
  await container.categoryService.update(req.params.id, { ...req.body, image });
  req.flash('success', 'Category updated.');
  res.redirect('/dashboard/categories');
});
