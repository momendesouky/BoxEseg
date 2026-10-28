const express = require('express');
const checkoutController = require('../controllers/CheckoutController');
const guestController = require('../controllers/GuestController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const orderValidators = require('../validators/orderValidators');
const guestValidators = require('../validators/guestValidators');
const { otpLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// GET /checkout serves both signed-in and guest renderings.
router.get('/', checkoutController.index);

router.post('/guest', guestValidators.checkoutStartRules, validate, guestController.startCheckout);
router.get('/guest/verify', guestController.showVerify);
router.post('/guest/verify', otpLimiter, guestValidators.otpVerifyRules, validate, guestController.verify);
router.post('/guest/resend', otpLimiter, guestController.resend);

router.post('/', requireAuth, orderValidators.checkoutRules, validate, checkoutController.checkout);

module.exports = router;
