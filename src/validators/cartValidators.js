const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.addItemRules = [
  body('productId').isMongoId().withMessage('Product is required.'),
  body('quantity').optional({ checkFalsy: true }).isInt({ min: 1, max: 500 }),
  body('cutNotes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

exports.updateItemRules = [
  mongoIdParam('productId'),
  body('quantity').isInt({ min: 0, max: 500 }).withMessage('Quantity must be zero or more.'),
];

exports.productIdRule = [mongoIdParam('productId')];

exports.couponRules = [
  body('code').trim().notEmpty().withMessage('Coupon code is required.').isLength({ max: 40 }),
];
