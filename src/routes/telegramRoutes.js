const express = require('express');
const guestController = require('../controllers/GuestController');
const { telegramPollLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// GET /telegram/status?code=XXXX — polled by the OTP verify page while a
// guest links their Telegram chat; the linked chat receives the OTP there.
router.get('/status', telegramPollLimiter, guestController.telegramStatus);

module.exports = router;
