const { body } = require('express-validator');

exports.checkoutStartRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('phone').trim().notEmpty().withMessage('Phone is required.').isLength({ max: 30 }),
  body('city').trim().notEmpty().withMessage('City is required.').isLength({ max: 80 }),
  body('area').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('street').trim().notEmpty().withMessage('Street address is required.').isLength({ max: 180 }),
  body('building').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('paymentMethod').isIn(['cod', 'paymob_card', 'paymob_wallet']).withMessage('Select a valid payment method.'),
  body('contactMethod').isIn(['email', 'telegram']).withMessage('Choose how you want the verification code sent.'),
  body('email')
    .if(body('contactMethod').equals('email'))
    .isEmail().withMessage('Enter a valid email address.')
    .normalizeEmail(),
];

exports.otpVerifyRules = [
  body('code')
    .trim()
    .notEmpty().withMessage('Enter the verification code.')
    .matches(/^\d{6}$/).withMessage('The verification code is 6 digits.'),
];

exports.contactLookupRules = [
  body('contact')
    .trim()
    .notEmpty().withMessage('Enter your email or phone number.')
    .isLength({ max: 120 }),
];
