const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.couponRules = [
  body('code').trim().notEmpty().withMessage('Coupon code is required.').isLength({ max: 40 }),
  body('type').isIn(['percent', 'fixed']).withMessage('Coupon type is invalid.'),
  body('value').isFloat({ min: 0 }).withMessage('Coupon value must be positive.'),
  body('minSubtotal').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('maxDiscount').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ checkFalsy: true }).isInt({ min: 0 }),
];

exports.idRule = [mongoIdParam('id')];
