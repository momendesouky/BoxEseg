const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const [{ products, pagination, filters, materialLabels }, categories] = await Promise.all([
    container.productService.list(req.query),
    container.categoryService.listActive(),
  ]);

  res.render('products/index', {
    title: 'Products',
    products,
    pagination,
    filters,
    categories,
    materialLabels,
  });
});

exports.show = catchAsync(async (req, res) => {
  const product = await container.productService.findBySlug(req.params.slug);
  const reviews = await container.reviewService.listForProduct(product.id);

  res.render('products/show', {
    title: product.name,
    product,
    reviews,
  });
});

exports.adminIndex = catchAsync(async (req, res) => {
  const { products, pagination, materialLabels } = await container.productService.list(req.query, { admin: true });

  res.render('dashboard/products/index', {
    title: 'Manage products',
    products,
    pagination,
    materialLabels,
  });
});

exports.adminCreateForm = catchAsync(async (req, res) => {
  const { categories } = await container.categoryService.listForAdmin({ limit: 100 });
  res.render('dashboard/products/form', {
    title: 'New product',
    product: null,
    categories,
    action: '/dashboard/products',
    method: 'POST',
  });
});

exports.adminCreate = catchAsync(async (req, res) => {
  let images = [];
  try {
    images = await container.uploadService.uploadImages(req.files || []);
  } catch (err) {
    console.error('[PRODUCT CREATE] Image upload failed:', err.message, err);
  }
  await container.productService.create({ ...req.body, images });
  req.flash('success', 'Product created.');
  res.redirect('/dashboard/products');
});

exports.adminEditForm = catchAsync(async (req, res) => {
  const [product, { categories }] = await Promise.all([
    container.productService.findAdminProduct(req.params.id),
    container.categoryService.listForAdmin({ limit: 100 }),
  ]);

  res.render('dashboard/products/form', {
    title: `Edit ${product.name}`,
    product,
    categories,
    action: `/dashboard/products/${product.id}?_method=PUT`,
    method: 'POST',
  });
});

exports.adminUpdate = catchAsync(async (req, res) => {
  let uploadedImages = [];
  try {
    uploadedImages = await container.uploadService.uploadImages(req.files || []);
  } catch (err) {
    require('../utils/logger').warn('Image upload failed during update: ' + err.message);
  }
  const existingProduct = await container.productService.findAdminProduct(req.params.id);
  const images = uploadedImages.length ? uploadedImages : existingProduct.images;

  await container.productService.update(req.params.id, { ...req.body, images });
  req.flash('success', 'Product updated.');
  res.redirect('/dashboard/products');
});

exports.adminDelete = catchAsync(async (req, res) => {
  await container.productService.remove(req.params.id);
  req.flash('success', 'Product archived.');
  res.redirect('/dashboard/products');
});
