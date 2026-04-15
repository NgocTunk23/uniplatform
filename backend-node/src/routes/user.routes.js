const express = require('express');
const router = express.Router();
const { updateProfile, changePassword } = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

router.put('/profile', protect, updateProfile);
router.patch('/change-password', protect, changePassword);

module.exports = router;
