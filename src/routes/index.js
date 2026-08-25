const express = require('express');

const homeRoutes = require('./homeRoutes');
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const cartRoutes = require('./cartRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const checkoutRoutes = require('./checkoutRoutes');
const orderRoutes = require('./orderRoutes');
const profileRoutes = require('./profileRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const paymentRoutes = require('./paymentRoutes');

const router = express.Router();

router.use('/', homeRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/profile', profileRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/payments', paymentRoutes);

module.exports = router;
