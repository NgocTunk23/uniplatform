const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspace.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createWorkspaceSchema, addMemberSchema } = require('../validations/workspace.schema');

router.use(protect); // All workspace routes are protected

/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     summary: Tạo Workspace mới
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *   get:
 *     summary: Lấy danh sách Workspace
 *     tags: [Workspaces]
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
 *                 $ref: '#/components/schemas/Workspace'
 */
router.post('/', validate(createWorkspaceSchema), workspaceController.createWorkspace);
router.get('/', workspaceController.getWorkspaces);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     summary: Lấy chi tiết Workspace và thành viên
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 */
router.get('/:id', workspaceController.getWorkspaceById);

/**
 * @swagger
 * /api/workspaces/{id}/members:
 *   post:
 *     summary: Thêm thành viên vào Workspace (Leader/Admin only)
 *     tags: [Workspaces]
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
 *             required: [username]
 *             properties:
 *               username: { type: string }
 *               workspacerole: { type: string, enum: [Leader, Member, Viewer], default: Member }
 *     responses:
 *       200:
 *         description: Thêm thành công
 */
router.post('/:id/members', validate(addMemberSchema), workspaceController.addMember);

/**
 * @swagger
 * /api/workspaces/{id}/members/{username}:
 *   delete:
 *     summary: Xóa thành viên khỏi Workspace (Leader/Admin only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *   patch:
 *     summary: Cập nhật quyền thành viên (Leader/Admin only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspacerole]
 *             properties:
 *               workspacerole: { type: string, enum: [Leader, Member, Viewer] }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.delete('/:id/members/:username', workspaceController.removeMember);
router.patch('/:id/members/:username', workspaceController.updateMemberRole);

module.exports = router;
