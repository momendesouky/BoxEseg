const express = require('express');
const cartController = require('../controllers/CartController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const cartValidators = require('../validators/cartValidators');

const router = express.Router();

router.use(requireAuth);
router.get('/', cartController.index);
router.post('/items', cartValidators.addItemRules, validate, cartController.addItem);
router.patch('/items/:productId', cartValidators.updateItemRules, validate, cartController.updateItem);
router.delete('/items/:productId', cartValidators.productIdRule, validate, cartController.removeItem);
router.post('/coupon', cartValidators.couponRules, validate, cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

module.exports = router;
