const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.createRules = [
  mongoIdParam('productId'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be from 1 to 5.'),
  body('title').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('comment').optional({ checkFalsy: true }).trim().isLength({ max: 1200 }),
];
