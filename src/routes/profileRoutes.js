const express = require('express');
const profileController = require('../controllers/ProfileController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const userValidators = require('../validators/userValidators');

const router = express.Router();

router.use(requireAuth);
router.get('/', profileController.show);
router.put('/', userValidators.profileRules, validate, profileController.updateProfile);
router.put('/password', userValidators.passwordRules, validate, profileController.updatePassword);

module.exports = router;
