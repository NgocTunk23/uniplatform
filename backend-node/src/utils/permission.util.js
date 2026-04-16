const prisma = require('../config/prisma');
const ApiError = require('./api-error');
const ERROR_CODES = require('../constants/error-codes');
const ROLES = require('../constants/roles');

/**
 * Higher-level permission checks for the application.
 */
const permissionUtil = {
  /**
   * Check if a user belongs to a workspace and return their role.
   * System Admins bypass this check.
   */
  getWorkspaceMembership: async (workspaceId, user) => {
    // 1. System Admin has full access
    if (user.role === ROLES.SYSTEM.ADMIN) {
      return { username: user.username, workspacerole: ROLES.WORKSPACE.LEADER, isSystemAdmin: true };
    }

    // 2. Query workspace with members
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { members: true }
    });

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found', ERROR_CODES.WORKSPACE.WKS_NOT_FOUND);
    }

    const membership = workspace.members.find(m => m.username === user.username);
    if (!membership) {
      throw new ApiError(403, 'Access denied. You are not a member of this workspace.', ERROR_CODES.AUTH.AUTH_ERROR);
    }

    return membership;
  },

  /**
   * Ensure user has at least Leader role in workspace OR is System Admin.
   */
  ensureLeader: async (workspaceId, user) => {
    const membership = await permissionUtil.getWorkspaceMembership(workspaceId, user);
    if (membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER) {
      return true;
    }
    throw new ApiError(403, 'Authority denied. Only Leaders can perform this action.', ERROR_CODES.AUTH.AUTH_ERROR);
  },

  /**
   * Ensure user can write (Chat/Upload).
   * Viewers are restricted to read-only.
   */
  ensureCanWrite: async (workspaceId, user) => {
    const membership = await permissionUtil.getWorkspaceMembership(workspaceId, user);
    if (membership.isSystemAdmin || membership.workspacerole !== ROLES.WORKSPACE.VIEWER) {
      return true;
    }
    throw new ApiError(403, 'Read-only access. Viewers cannot perform this action.', ERROR_CODES.AUTH.AUTH_ERROR);
  }
};

module.exports = permissionUtil;
