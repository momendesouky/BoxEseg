const env = require('../config/env');
const logger = require('../utils/logger');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api') || req.xhr || req.accepts(['html', 'json']) === 'json';
}

module.exports = function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Something went wrong.';

  if (!error.isOperational) {
    logger.error(error.message, error.stack);
  }

  if (wantsJson(req)) {
    return res.status(statusCode).json({
      status: error.status || 'error',
      message,
      details: env.isProduction ? undefined : error.details,
    });
  }

  return res.status(statusCode).render('error/error', {
    title: statusCode === 404 ? 'Page not found' : 'Something went wrong',
    statusCode,
    message,
    stack: env.isProduction ? null : error.stack,
  });
};
