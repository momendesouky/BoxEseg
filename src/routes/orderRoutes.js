const express = require('express');
const orderController = require('../controllers/OrderController');
const guestController = require('../controllers/GuestController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const orderValidators = require('../validators/orderValidators');
const guestValidators = require('../validators/guestValidators');
const { otpLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// ── guest order tracking (public, OTP-gated via session identity) ────────
router.get('/guest', guestController.trackIndex);
router.post('/guest/lookup', otpLimiter, guestValidators.contactLookupRules, validate, guestController.trackLookup);
router.get('/guest/verify', guestController.showVerify);
router.post('/guest/verify', otpLimiter, guestValidators.otpVerifyRules, validate, guestController.verify);
router.post('/guest/resend', otpLimiter, guestController.resend);
router.post('/guest/logout', guestController.trackLogout);
router.get('/guest/:orderNumber', guestController.trackShow);

// ── signed-in orders ─────────────────────────────────────────────────────
router.use(requireAuth);
router.get('/', orderController.index);
router.get('/:id', orderValidators.orderIdRule, validate, orderController.show);
router.get('/:id/invoice', orderValidators.orderIdRule, validate, orderController.invoice);

module.exports = router;
