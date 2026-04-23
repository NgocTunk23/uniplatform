const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const auth = require('../middlewares/auth.middleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Tải tệp tin lên Google Drive
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/File'
 */
router.post('/upload', auth.protect, uploadMiddleware.single('file'), fileController.uploadFile);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Xóa tệp tin khỏi hệ thống (Uploader/Leader/Admin only)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/:id', auth.protect, fileController.deleteFile);

module.exports = router;
