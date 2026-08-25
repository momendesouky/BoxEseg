const express = require('express');
const orderController = require('../controllers/OrderController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const orderValidators = require('../validators/orderValidators');

const router = express.Router();

router.use(requireAuth);
router.get('/', orderController.index);
router.get('/:id', orderValidators.orderIdRule, validate, orderController.show);
router.get('/:id/invoice', orderValidators.orderIdRule, validate, orderController.invoice);

module.exports = router;
