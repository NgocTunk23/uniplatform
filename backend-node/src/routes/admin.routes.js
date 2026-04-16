const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const ROLES = require('../constants/roles');

router.use(protect);
router.use(authorize(ROLES.SYSTEM.ADMIN)); // Only System Admins can access these routes

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Xem chỉ số sức khỏe hệ thống và hạn mức GDrive
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/stats', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Danh sách người dùng toàn hệ thống
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     summary: Khóa hoặc mở khóa tài khoản
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, locked] }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch('/users/:id/status', adminController.updateUserStatus);

/**
 * @swagger
 * /api/admin/users/{id}/force-logout:
 *   post:
 *     summary: Cưỡng chế đăng xuất (Vô hiệu hóa Token)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Người dùng đã bị cưỡng chế đăng xuất
 */
router.post('/users/:id/force-logout', protect, authorize(ROLES.SYSTEM.ADMIN), adminController.forceLogoutUser);

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Xem nhật ký hệ thống (Audit Logs)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemLog'
 */
router.get('/logs', adminController.getSystemLogs);

module.exports = router;
