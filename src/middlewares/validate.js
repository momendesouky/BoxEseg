const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

module.exports = function validate(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const errors = result.array().map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  if (req.accepts(['html', 'json']) === 'json') {
    return next(new AppError('Validation failed.', 422, errors));
  }

  req.flash('error', errors.map((error) => error.message).join(' '));
  return res.redirect(req.get('referer') || '/');
};
