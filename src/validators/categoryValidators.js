const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.categoryRules = [
  body('name').trim().notEmpty().withMessage('Category name is required.').isLength({ max: 120 }),
  body('slug').optional({ checkFalsy: true }).trim().isLength({ max: 140 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 600 }),
  body('sortOrder').optional({ checkFalsy: true }).isInt({ min: 0 }),
];

exports.idRule = [mongoIdParam('id')];
