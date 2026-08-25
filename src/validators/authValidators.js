const { body } = require('express-validator');

exports.registerRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 80 }),
  body('lastName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.'),
  body('passwordConfirm').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Password confirmation does not match.');
    return true;
  }),
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

exports.forgotRules = [
  body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
];

exports.resetRules = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
  body('passwordConfirm').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Password confirmation does not match.');
    return true;
  }),
];
