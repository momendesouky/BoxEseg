const express = require('express');
const paymentController = require('../controllers/PaymentController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/paymob/callback', paymentController.paymobCallback);
router.post('/paymob/webhook', paymentController.paymobWebhook);

router.get('/wallet', requireAuth, paymentController.walletPage);
router.post('/wallet', requireAuth, paymentController.walletPay);
router.get('/status/:orderNumber', requireAuth, paymentController.paymentStatus);

module.exports = router;
