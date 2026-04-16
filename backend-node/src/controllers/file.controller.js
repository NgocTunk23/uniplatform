const gdriveUtil = require('../utils/gdrive.util');
const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const permissionUtil = require('../utils/permission.util');
const ROLES = require('../constants/roles');

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a file to Google Drive and save metadata
 *     tags: [File]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               messageid: { type: string }
 *               meetingminuteid: { type: string }
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded', ERROR_CODES.FILE.FILE_MISSING);
    }

    // Upload to Google Drive
    const driveData = await gdriveUtil.uploadFile(req.file);

    // Sanitize input fields to prevent Prisma Malformed ObjectID errors
    // If a string is empty or not a valid 24-char hex string, set as undefined so Prisma ignores it
    const sanitizedMessageId = (req.body.messageid && /^[0-9a-fA-F]{24}$/.test(req.body.messageid)) ? req.body.messageid : undefined;
    const sanitizedMeetingMinuteId = req.body.meetingminuteid || undefined;

    // Save metadata to database via Prisma
    const newFile = await prisma.file.create({
      data: {
        uploader: req.user.username,
        filename: driveData.name,
        ggid: driveData.id,
        typefile: req.file.mimetype,
        sizefile: req.file.size.toString(),
        messageId: sanitizedMessageId,
        meetingminuteid: sanitizedMeetingMinuteId,
      },
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      file: newFile,
      webViewLink: driveData.webViewLink,
      downloadLink: gdriveUtil.getDownloadLink(driveData.id)
    });
  } catch (error) {
    console.error('❌ File Controller Upload Error:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete a file from Drive and database
 *     tags: [File]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: File deleted
 */
const deleteFile = async (req, res, next) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });
    
    if (!file) throw new ApiError(404, 'File not found', ERROR_CODES.FILE.FILE_NOT_FOUND);

    // RBAC logic:
    let isAuthorized = false;

    // 1. System Admin bypass
    if (req.user.role === ROLES.SYSTEM.ADMIN) {
      isAuthorized = true;
    }
    // 2. Uploader bypass
    else if (file.uploader === req.user.username) {
      isAuthorized = true;
    }
    // 3. Workspace Leader bypass
    else if (file.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: file.messageId },
        select: { workspaceId: true }
      });
      if (message) {
        const membership = await permissionUtil.getWorkspaceMembership(message.workspaceId, req.user);
        if (membership.workspacerole === ROLES.WORKSPACE.LEADER) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new ApiError(403, 'Unauthorized. Only uploader, Workspace Leader, or System Admin can delete this file.', ERROR_CODES.AUTH.AUTH_ERROR);
    }

    // Delete from Google Drive
    await gdriveUtil.deleteFile(file.ggid);

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  deleteFile
};
