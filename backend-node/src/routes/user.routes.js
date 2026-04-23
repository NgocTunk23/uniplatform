const express = require('express');
const router = express.Router();
const { updateProfile, changePassword } = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname: { type: string }
 *               dateofbirth: { type: string, format: date }
 *               address: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.put('/profile', protect, updateProfile);

/**
 * @swagger
 * /api/users/change-password:
 *   patch:
 *     summary: Thay đổi mật khẩu
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 */
router.patch('/change-password', protect, changePassword);

module.exports = router;
