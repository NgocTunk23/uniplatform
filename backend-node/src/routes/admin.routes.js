const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const ROLES = require('../constants/roles');

router.use(protect);
router.use(authorize(ROLES.SYSTEM.ADMIN)); // Only System Admins can access these routes

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
/**
 * @swagger
 * /api/admin/users/{id}/force-logout:
 *   post:
 *     summary: Force logout a user (increment tokenVersion)
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
 *         description: User forced out
 */
router.post('/users/:id/force-logout', protect, authorize(ROLES.SYSTEM.ADMIN), adminController.forceLogoutUser);
router.get('/logs', adminController.getSystemLogs);

module.exports = router;
