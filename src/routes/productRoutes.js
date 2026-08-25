const express = require('express');
const productController = require('../controllers/ProductController');
const reviewController = require('../controllers/ReviewController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const productValidators = require('../validators/productValidators');
const reviewValidators = require('../validators/reviewValidators');

const router = express.Router();

router.get('/', productValidators.listRules, validate, productController.index);
router.get('/:slug', productController.show);
router.post('/:productId/reviews', requireAuth, reviewValidators.createRules, validate, reviewController.create);

module.exports = router;
