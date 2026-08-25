const { body } = require('express-validator');
const { mongoIdParam } = require('./commonValidators');

exports.profileRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 80 }),
  body('lastName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
];

exports.passwordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  body('passwordConfirm').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Password confirmation does not match.');
    return true;
  }),
];

exports.adminUpdateRules = [
  mongoIdParam('id'),
  body('role').isIn(['customer', 'admin']),
  body('isActive').isIn(['true', 'false']),
];
