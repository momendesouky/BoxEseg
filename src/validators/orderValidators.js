const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.checkoutRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('phone').trim().notEmpty().withMessage('Phone is required.').isLength({ max: 30 }),
  body('city').trim().notEmpty().withMessage('City is required.').isLength({ max: 80 }),
  body('area').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('street').trim().notEmpty().withMessage('Street address is required.').isLength({ max: 180 }),
  body('building').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('paymentMethod').isIn(['cod', 'paymob_card', 'paymob_wallet']).withMessage('Select a valid payment method.'),
];

exports.orderIdRule = [mongoIdParam('id')];

exports.adminUpdateRules = [
  mongoIdParam('id'),
  body('status').optional({ checkFalsy: true }).isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  body('paymentStatus').optional({ checkFalsy: true }).isIn(['pending', 'paid', 'failed', 'refunded']),
];
