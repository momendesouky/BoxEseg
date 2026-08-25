const express = require('express');
const authController = require('../controllers/AuthController');
const validate = require('../middlewares/validate');
const { requireGuest } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');
const authValidators = require('../validators/authValidators');

const router = express.Router();

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', authLimiter, requireGuest, authValidators.registerRules, validate, authController.register);
router.get('/login', requireGuest, authController.showLogin);
router.post('/login', authLimiter, requireGuest, authValidators.loginRules, validate, authController.login);
router.post('/logout', authController.logout);
router.get('/forgot-password', requireGuest, authController.showForgotPassword);
router.post('/forgot-password', authLimiter, requireGuest, authValidators.forgotRules, validate, authController.forgotPassword);
router.get('/reset-password/:token', requireGuest, authController.showResetPassword);
router.post('/reset-password/:token', authLimiter, requireGuest, authValidators.resetRules, validate, authController.resetPassword);
router.get('/facebook', requireGuest, authController.facebookStart);
router.get('/facebook/callback', requireGuest, authController.facebookCallback);
router.get('/google', requireGuest, authController.googleStart);
router.get('/google/callback', requireGuest, authController.googleCallback);

module.exports = router;
