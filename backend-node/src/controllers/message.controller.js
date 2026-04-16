const messageService = require('../services/message.service');

/**
 * @swagger
 * /api/messages/{workspaceId}:
 *   get:
 *     summary: Get chat history for a workspace
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of messages
 */
const getChatHistory = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    const messages = await messageService.getMessagesByWorkspace(workspaceId, req.user, limit, skip);
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatHistory,
};
