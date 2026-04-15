const gdriveUtil = require('../utils/gdrive.util');
const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

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

    // RBAC: Only uploader can delete for now
    // In production, uploader OR workspace admin should be allowed
    if (file.uploader !== req.user.username) {
      throw new ApiError(403, 'Unauthorized to delete this file. Only the uploader can remove it.', ERROR_CODES.AUTH.AUTH_ERROR);
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
