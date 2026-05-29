const gdriveUtil = require('../utils/gdrive.util');
const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const permissionUtil = require('../utils/permission.util');
const ROLES = require('../constants/roles');
const { decryptSecret } = require('../utils/secret.util');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const sanitizeObjectId = (value) => {
  if (!value || typeof value !== 'string') return undefined;
  return OBJECT_ID_REGEX.test(value) ? value : undefined;
};

const getConnectedDriveForUser = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      googleDriveEmail: true,
      googleDriveRefreshToken: true,
      googleDriveFolderId: true,
    },
  });

  if (!user?.googleDriveEmail || !user?.googleDriveRefreshToken) {
    throw new ApiError(
      409,
      'Google Drive is not connected. Connect it in Drive Files first.',
      ERROR_CODES.FILE.GOOGLE_DRIVE_NOT_CONNECTED
    );
  }

  const refreshToken = decryptSecret(user.googleDriveRefreshToken);
  let folderId = user.googleDriveFolderId;

  if (!folderId) {
    const drive = gdriveUtil.getDriveClientForRefreshToken(refreshToken);
    const folder = await gdriveUtil.ensureAppFolder(drive);
    folderId = folder.id;
    await prisma.user.update({
      where: { username },
      data: { googleDriveFolderId: folderId },
    });
  }

  return {
    email: user.googleDriveEmail,
    refreshToken,
    folderId,
  };
};

const assertCanAttachToMessage = async (messageid, user) => {
  if (!messageid) return undefined;

  const message = await prisma.messages.findUnique({
    where: { messageid },
    select: { workspaceid: true },
  });

  if (!message) {
    throw new ApiError(400, 'Message not found', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  await permissionUtil.ensureCanWrite(message.workspaceid, user);
  return messageid;
};

const assertCanAttachToMeetingMinute = async (meetingminuteid, user) => {
  if (!meetingminuteid) return undefined;

  const minute = await prisma.meetingMinutes.findUnique({
    where: { meetingminuteid },
    include: {
      meeting: {
        select: {
          workspaceid: true,
          organizer: true,
        },
      },
    },
  });

  if (!minute) {
    throw new ApiError(400, 'Meeting minutes not found', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  const membership = await permissionUtil.getWorkspaceMembership(minute.meeting.workspaceid, user);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const canAttach = isLeader || minute.createby === user.username || minute.meeting.organizer === user.username;

  if (!canAttach) {
    throw new ApiError(403, 'Only the meeting organizer, minute owner, or Workspace Leader can attach files.', ERROR_CODES.AUTH.AUTH_ERROR);
  }

  return meetingminuteid;
};

const getAccessibleWorkspaceIds = async (user) => {
  if (user.role === ROLES.SYSTEM.ADMIN) return null;

  const workspaces = await prisma.workspace.findMany({
    where: {
      member: {
        some: { username: user.username },
      },
    },
    select: { workspaceid: true },
  });

  return workspaces.map((workspace) => workspace.workspaceid);
};

const buildFileResponse = (file) => ({
  ...file,
  id: file.fileid,
  workspace: file.message?.workspace || file.meetingMinute?.meeting || null,
  downloadLink: gdriveUtil.getDownloadLink(file.ggid),
  webViewLink: `https://drive.google.com/file/d/${file.ggid}/view`,
});

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

    // Fix UTF-8 encoding for originalname (Multer default is latin1)
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Sanitize input fields to prevent Prisma Malformed ObjectID errors.
    // Invalid IDs from legacy clients are ignored for backward compatibility.
    const sanitizedMessageId = sanitizeObjectId(req.body.messageid);
    const sanitizedMeetingMinuteId = sanitizeObjectId(req.body.meetingminuteid);
    const messageid = await assertCanAttachToMessage(sanitizedMessageId, req.user);
    const meetingminuteid = await assertCanAttachToMeetingMinute(sanitizedMeetingMinuteId, req.user);

    const driveAuth = await getConnectedDriveForUser(req.user.username);

    // Upload to the authenticated user's connected Google Drive only after authorization succeeds.
    console.log('📤 Uploading file to Drive:', req.file.originalname);
    const driveData = await gdriveUtil.uploadFileForUser(req.file, driveAuth);
    console.log('✅ Drive response:', { id: driveData?.id, name: driveData?.name, owner: driveAuth.email });

    // Save metadata to database via Prisma
    if (!driveData) {
      throw new ApiError(500, 'Failed to get data from Google Drive', ERROR_CODES.FILE.UPLOAD_FAILED);
    }

    if (!prisma.files) {
      console.error('❌ prisma.files is undefined! Available models:', Object.keys(prisma).filter(k => !k.startsWith('_')));
      throw new ApiError(500, 'Database model "Files" not found', ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR);
    }

    const newFile = await prisma.files.create({
      data: {
        uploader: req.user.username,
        filename: driveData.name,
        ggid: driveData.id,
        typefile: req.file.mimetype,
        sizefile: req.file.size.toString(),
        messageid,
        meetingminuteid,
      },
    });

    const downloadLink = gdriveUtil.getDownloadLink(driveData.id);
    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        ...newFile,
        id: newFile.fileid // Provide 'id' for frontend compatibility
      },
      webViewLink: driveData.webViewLink,
      downloadLink,
      url: downloadLink,
    });
  } catch (error) {
    console.error('❌ File Controller Upload Error:', error);
    if (error instanceof ApiError) {
      return next(error);
    }

    const driveStatus = error?.response?.status || error?.code;
    if (driveStatus === 403 || driveStatus === 429) {
      return next(new ApiError(
        503,
        'Google Drive storage is unavailable or quota is full. Please try again later or delete old files.',
        ERROR_CODES.FILE.UPLOAD_FAILED
      ));
    }

    next(new ApiError(
      500,
      'Unable to upload file to Google Drive',
      ERROR_CODES.FILE.UPLOAD_FAILED
    ));
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
    const file = await prisma.files.findUnique({
      where: { fileid: req.params.id },
      include: {
        message: {
          select: { workspaceid: true },
        },
        meetingMinute: {
          include: {
            meeting: {
              select: {
                workspaceid: true,
                organizer: true,
              },
            },
          },
        },
      },
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
    else if (file.message?.workspaceid) {
      const membership = await permissionUtil.getWorkspaceMembership(file.message.workspaceid, req.user);
      if (membership.workspacerole === ROLES.WORKSPACE.LEADER) {
        isAuthorized = true;
      }
    }
    // 4. Workspace Leader or meeting organizer can delete meeting-minute files
    else if (file.meetingMinute?.meeting?.workspaceid) {
      const membership = await permissionUtil.getWorkspaceMembership(file.meetingMinute.meeting.workspaceid, req.user);
      const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
      const isOrganizer = file.meetingMinute.meeting.organizer === req.user.username;

      if (isLeader || isOrganizer) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ApiError(403, 'Unauthorized. Only uploader, Workspace Leader, meeting organizer, or System Admin can delete this file.', ERROR_CODES.AUTH.AUTH_ERROR);
    }

    // Delete from the uploader's connected Google Drive. Old mock/global files fall back
    // to the legacy delete path so existing records can still be removed.
    const uploader = await prisma.user.findUnique({
      where: { username: file.uploader },
      select: { googleDriveRefreshToken: true },
    });

    if (uploader?.googleDriveRefreshToken && !file.ggid.startsWith('mock_')) {
      await gdriveUtil.deleteFileForUser(file.ggid, decryptSecret(uploader.googleDriveRefreshToken));
    } else {
      await gdriveUtil.deleteFile(file.ggid);
    }

    // Delete from database
    await prisma.files.delete({
      where: { fileid: req.params.id },
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getFiles = async (req, res, next) => {
  try {
    const { workspaceid } = req.query;

    let where;

    if (workspaceid) {
      await permissionUtil.getWorkspaceMembership(workspaceid, req.user);
      where = {
        OR: [
          { message: { is: { workspaceid } } },
          { meetingMinute: { is: { meeting: { is: { workspaceid } } } } },
        ],
      };
    } else if (req.user.role === ROLES.SYSTEM.ADMIN) {
      where = {};
    } else {
      const workspaceIds = await getAccessibleWorkspaceIds(req.user);
      where = {
        OR: [
          { uploader: req.user.username },
          { message: { is: { workspaceid: { in: workspaceIds } } } },
          { meetingMinute: { is: { meeting: { is: { workspaceid: { in: workspaceIds } } } } } },
        ],
      };
    }

    const files = await prisma.files.findMany({
      where,
      include: {
        message: {
          select: {
            workspaceid: true,
            workspace: { select: { workspaceid: true, name: true } },
          },
        },
        meetingMinute: {
          select: {
            meetingid: true,
            meeting: { select: { workspaceid: true, title: true } },
          },
        },
      },
      orderBy: { createdat: 'desc' },
    });

    res.json({ success: true, data: files.map(buildFileResponse) });
  } catch (error) {
    next(error);
  }
};

const getFilesQuota = async (req, res, next) => {
  try {
    const driveAuth = await getConnectedDriveForUser(req.user.username);
    const quota = await gdriveUtil.getStorageQuotaForUser(driveAuth.refreshToken);
    if (!quota) {
      return res.json({ limit: null, usage: null, remaining: null });
    }
    res.json({ limit: quota.limit, usage: quota.usage, remaining: quota.remaining });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getFiles,
  getFilesQuota,
};
