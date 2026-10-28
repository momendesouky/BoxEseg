const express = require('express');
const paymentController = require('../controllers/PaymentController');

const router = express.Router();

router.get('/paymob/callback', paymentController.paymobCallback);
router.post('/paymob/webhook', paymentController.paymobWebhook);

// Wallet + status routes are self-gated: they only act when the session holds
// a pendingPaymentOrder, so signed-in and guest checkouts share them.
router.get('/wallet', paymentController.walletPage);
router.post('/wallet', paymentController.walletPay);
router.get('/status/:orderNumber', paymentController.paymentStatus);

module.exports = router;
