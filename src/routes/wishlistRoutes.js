const express = require('express');
const wishlistController = require('../controllers/WishlistController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { productIdRule } = require('../validators/productValidators');

const router = express.Router();

router.use(requireAuth);
router.get('/', wishlistController.index);
router.post('/:productId', productIdRule, validate, wishlistController.add);
router.delete('/:productId', productIdRule, validate, wishlistController.remove);

module.exports = router;
