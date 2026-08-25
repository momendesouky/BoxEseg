const express = require('express');
const dashboardController = require('../controllers/DashboardController');
const productController = require('../controllers/ProductController');
const categoryController = require('../controllers/CategoryController');
const orderController = require('../controllers/OrderController');
const couponController = require('../controllers/CouponController');
const { requireAuth, authorize } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');
const validate = require('../middlewares/validate');
const productValidators = require('../validators/productValidators');
const categoryValidators = require('../validators/categoryValidators');
const orderValidators = require('../validators/orderValidators');
const userValidators = require('../validators/userValidators');
const couponValidators = require('../validators/couponValidators');

const router = express.Router();

router.use(requireAuth, authorize('admin'));

router.get('/', dashboardController.index);

router.get('/products', productController.adminIndex);
router.get('/products/new', productController.adminCreateForm);
router.post('/products', upload.array('images', 8), productValidators.adminProductRules, validate, productController.adminCreate);
router.get('/products/:id/edit', productValidators.idRule, validate, productController.adminEditForm);
router.put('/products/:id', upload.array('images', 8), productValidators.idRule, productValidators.adminProductRules, validate, productController.adminUpdate);
router.delete('/products/:id', productValidators.idRule, validate, productController.adminDelete);

router.get('/categories', categoryController.adminIndex);
router.get('/categories/new', categoryController.adminCreateForm);
router.post('/categories', upload.array('images', 1), categoryValidators.categoryRules, validate, categoryController.adminCreate);
router.get('/categories/:id/edit', categoryValidators.idRule, validate, categoryController.adminEditForm);
router.put('/categories/:id', upload.array('images', 1), categoryValidators.idRule, categoryValidators.categoryRules, validate, categoryController.adminUpdate);

router.get('/orders', orderController.adminIndex);
router.get('/orders/:id', orderValidators.orderIdRule, validate, orderController.adminShow);
router.put('/orders/:id', orderValidators.adminUpdateRules, validate, orderController.adminUpdate);

router.get('/users', dashboardController.users);
router.put('/users/:id', userValidators.adminUpdateRules, validate, dashboardController.updateUser);

router.get('/inventory', dashboardController.inventory);

router.get('/coupons', couponController.adminIndex);
router.post('/coupons', couponValidators.couponRules, validate, couponController.adminCreate);
router.put('/coupons/:id', couponValidators.idRule, couponValidators.couponRules, validate, couponController.adminUpdate);

router.get('/reports', dashboardController.reports);

module.exports = router;
