const { body, query } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.listRules = [
  query('q').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  query('category').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  query('material').optional({ checkFalsy: true }).isIn(['MDF', 'PLYWOOD', 'PVC', 'HPL', 'WOOD_PANEL', 'OTHER']),
  query('minPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('maxPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('sort').optional({ checkFalsy: true }).isIn(['latest', 'price_asc', 'price_desc', 'name', 'rating']),
];

exports.adminProductRules = [
  body('name').trim().notEmpty().withMessage('Product name is required.').isLength({ max: 160 }),
  body('sku').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('category').isMongoId().withMessage('Category is required.'),
  body('material').optional({ checkFalsy: true }).isIn(['MDF', 'PLYWOOD', 'PVC', 'HPL', 'WOOD_PANEL', 'OTHER']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be positive.'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be zero or more.'),
  body('status').isIn(['draft', 'active', 'archived']),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('shortDescription').optional({ checkFalsy: true }).trim().isLength({ max: 280 }),
];

exports.productIdRule = [mongoIdParam('productId')];
exports.idRule = [mongoIdParam('id')];
