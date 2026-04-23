const prisma = require('../config/prisma');
const os = require('os');
const ApiError = require('../utils/api-error');
const { getStorageQuota } = require('../utils/gdrive.util');
const { logChange } = require('../utils/audit-logger.util');

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    const workspaceCount = await prisma.workspace.count();
    const messageCount = await prisma.message.count();
    
    const freeMem = os.freemem() / 1024 / 1024 / 1024;
    const totalMem = os.totalmem() / 1024 / 1024 / 1024;
    
    const quota = await getStorageQuota();
    
    res.json({
      counts: {
        users: userCount,
        workspaces: workspaceCount,
        messages: messageCount
      },
      system: {
        cpu: os.cpus()[0].model,
        memory: {
          free: freeMem.toFixed(2) + ' GB',
          total: totalMem.toFixed(2) + ' GB',
          usage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2) + '%'
        },
        platform: os.platform(),
        uptime: (os.uptime() / 3600).toFixed(2) + ' hours',
        googleDrive: quota ? {
          limit: (quota.limit / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          usage: (quota.usage / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          remaining: (quota.remaining / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          usagePercent: ((quota.usage / quota.limit) * 100).toFixed(2) + '%'
        } : 'Quota info unavailable'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullname: true,
        role: true,
        status: true,
        createdAt: true,
      }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     summary: Update user status (lock/unlock)
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
 *             properties:
 *               status: { type: string, enum: [active, locked] }
 *     responses:
 *       200:
 *         description: Status updated
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const oldUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!oldUser) throw new ApiError(404, 'User not found');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Log the change
    await logChange(req.user.username, 'User', user.id, oldUser, user);

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system logs
 */
const getSystemLogs = async (req, res, next) => {
  try {
    const logs = await prisma.systemLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Force logout a user by incrementing their tokenVersion
 */
const forceLogoutUser = async (req, res, next) => {
  try {
    const oldUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!oldUser) throw new ApiError(404, 'User not found');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { tokenVersion: { increment: 1 } },
    });

    // Log the change
    await logChange(req.user.username, 'User', user.id, oldUser, user);

    res.json({ message: 'User force logged out successfully', tokenVersion: user.tokenVersion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getSystemLogs,
  forceLogoutUser
};
