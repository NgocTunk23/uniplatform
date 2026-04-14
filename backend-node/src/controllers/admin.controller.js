const prisma = require('../config/prisma');
const os = require('os');
const ApiError = require('../utils/api-error');

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
        uptime: (os.uptime() / 3600).toFixed(2) + ' hours'
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
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
    });
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

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getSystemLogs
};
