const express = require('express');
const checkoutController = require('../controllers/CheckoutController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const orderValidators = require('../validators/orderValidators');

const router = express.Router();

router.use(requireAuth);
router.get('/', checkoutController.index);
router.post('/', orderValidators.checkoutRules, validate, checkoutController.checkout);

module.exports = router;
