const workspaceService = require('../services/workspace.service');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

/**
 * @swagger
 * components:
 *   schemas:
 *     Workspace:
 *       type: object
 *       required:
 *         - name
 *         - admin
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         admin:
 *           type: string
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               workspacerole: { type: string, enum: [Leader, Member] }
 *               joinedat: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     summary: Create a new workspace
 *     tags: [Workspace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Workspace'
 *     responses:
 *       201:
 *         description: Workspace created
 */
const createWorkspace = async (req, res, next) => {
  try {
    const workspace = await workspaceService.createWorkspace(req.body);
    res.status(201).json(workspace);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     summary: Get all workspaces
 *     tags: [Workspace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 */
const getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await workspaceService.getAllWorkspaces();
    res.json(workspaces);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     summary: Get workspace details by ID
 *     tags: [Workspace]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workspace details
 */
const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await workspaceService.getWorkspaceById(req.params.id);
    if (!workspace) throw new ApiError(404, 'Workspace not found', ERROR_CODES.WORKSPACE.WKS_NOT_FOUND);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/workspaces/{id}/members:
 *   post:
 *     summary: Add member to workspace
 *     tags: [Workspace]
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
 *             properties:
 *               username: { type: string }
 *               workspacerole: { type: string }
 *     responses:
 *       200:
 *         description: Member added
 */
const addMember = async (req, res, next) => {
  try {
    const workspace = await workspaceService.addMember(req.params.id, req.body);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const workspace = await workspaceService.removeMember(req.params.id, req.params.username);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const { workspacerole } = req.body;
    const workspace = await workspaceService.updateMemberRole(req.params.id, req.params.username, workspacerole);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  addMember,
  removeMember,
  updateMemberRole,
};
