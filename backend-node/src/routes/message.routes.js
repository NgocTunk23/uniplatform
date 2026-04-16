const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

/**
 * @swagger
 * /api/messages/{workspaceId}:
 *   get:
 *     summary: Lấy lịch sử tin nhắn của Workspace (Phân trang)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Số trang cần lấy
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Số tin nhắn mỗi trang
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Message' }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     pages: { type: integer }
 */
router.get('/:workspaceId', messageController.getChatHistory);

module.exports = router;
