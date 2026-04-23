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

const getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await workspaceService.getAllWorkspaces(req.user);
    res.json(workspaces);
  } catch (error) {
    next(error);
  }
};

const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await workspaceService.getWorkspaceById(req.params.id, req.user);
    if (!workspace) throw new ApiError(404, 'Workspace not found', ERROR_CODES.WORKSPACE.WKS_NOT_FOUND);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

const addMember = async (req, res, next) => {
  try {
    const workspace = await workspaceService.addMember(req.params.id, req.body, req.user);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const workspace = await workspaceService.removeMember(req.params.id, req.params.username, req.user);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const { workspacerole } = req.body;
    const workspace = await workspaceService.updateMemberRole(req.params.id, req.params.username, workspacerole, req.user);
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
