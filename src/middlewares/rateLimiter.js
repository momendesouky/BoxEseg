const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts. Please try again later.',
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many verification requests. Please try again later.',
});

// The Telegram link poller is called every ~3s while the page is open, so it
// needs a much higher ceiling than the OTP endpoints.
const telegramPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many Telegram link checks. Please refresh the page and try again.',
});

module.exports = { generalLimiter, authLimiter, otpLimiter, telegramPollLimiter };
