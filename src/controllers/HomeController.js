const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.index = catchAsync(async (req, res) => {
  const [featuredProducts, categories] = await Promise.all([
    container.productService.featured(6),
    container.categoryService.listActive(),
  ]);

  res.render('home/index', {
    title: 'Boards, panels, and surfaces for modern interiors',
    featuredProducts,
    categories,
  });
});
