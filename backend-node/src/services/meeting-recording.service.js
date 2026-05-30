const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const ROLES = require('../constants/roles');
const permissionUtil = require('../utils/permission.util');
const gdriveUtil = require('../utils/gdrive.util');
const { decryptSecret } = require('../utils/secret.util');
const { sanitizeRecordingMetadata } = require('../utils/recording-metadata.util');
const recordingManager = require('./recording-manager.service');
const recordingProcessor = require('./recording-processing.service');

const isRecordingEnabled = () => process.env.RECORDING_ENABLED !== 'false';
const getMaxRecordingMinutes = () => {
  const minutes = Number(process.env.MAX_RECORDING_MINUTES || 180);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 180;
};

const getServerUrl = () => (
  process.env.RECORDING_SOCKET_URL ||
  process.env.BACKEND_PUBLIC_URL ||
  `http://localhost:${process.env.PORT || 5001}`
).replace(/\/$/, '');

const sanitizeError = (error) => String(error?.message || error || 'Recording failed').slice(0, 500);

const ensureCanManageRecording = async (meeting, currentUser) => {
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const isOrganizer = meeting.organizer === currentUser.username;

  if (!isLeader && !isOrganizer) {
    throw new ApiError(403, 'Only the meeting organizer or Workspace Leader can manage recording.', ERROR_CODES.AUTH.AUTH_ERROR);
  }
};

const getAuthorizedMeeting = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) throw new ApiError(404, 'Meeting not found');
  await ensureCanManageRecording(meeting, currentUser);
  return meeting;
};

const buildRecordingStatus = (meeting) => ({
  meetingid: meeting.meetingid,
  bot_status: meeting.bot_status || 'idle',
  recording_file: meeting.recording_file || null,
  recordingDownloadLink: meeting.recording_file ? gdriveUtil.getDownloadLink(meeting.recording_file) : null,
  recording_startedat: meeting.recording_startedat || null,
  recording_endedat: meeting.recording_endedat || null,
  recording_error: meeting.recording_error || null,
  recording_metadata: sanitizeRecordingMetadata(meeting.recording_metadata),
  isActiveSession: recordingManager.hasActiveSession(meeting.meetingid),
});

const runProcessingJob = async ({ meetingId, stopResult, createby }) => {
  const job = recordingProcessor.processMeetingRecording({
    meetingId,
    audioPath: stopResult.audioPath,
    cleanup: stopResult.cleanup,
    captureMetadata: stopResult.captureMetadata,
    createby,
  }).catch(async (error) => {
    console.error('Recording processing job failed:', error.message);
    await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: { bot_status: 'failed', recording_error: sanitizeError(error) },
    }).catch(() => undefined);
  });

  if (process.env.RECORDING_PROCESS_SYNC === 'true') {
    await job;
  }
};

const handleMaxDurationReached = async (meetingId, createby) => {
  if (!recordingManager.hasActiveSession(meetingId)) return;

  try {
    await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        bot_status: 'processing',
        recording_endedat: new Date(),
        recording_error: null,
        recording_metadata: {
          stage: 'max_duration_stop',
          maxRecordingMinutes: getMaxRecordingMinutes(),
          reason: `Recording reached MAX_RECORDING_MINUTES=${getMaxRecordingMinutes()}`,
        },
      },
    });

    const stopResult = await recordingManager.stopRecording(meetingId);
    await runProcessingJob({ meetingId, stopResult, createby });
  } catch (error) {
    await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        bot_status: 'failed',
        recording_error: sanitizeError(error),
        recording_endedat: new Date(),
        recording_metadata: {
          stage: 'failed',
          errorStage: 'recording',
          maxRecordingMinutes: getMaxRecordingMinutes(),
        },
      },
    }).catch(() => undefined);
  }
};

const startRecording = async (meetingId, currentUser, authToken) => {
  if (!isRecordingEnabled()) {
    throw new ApiError(503, 'Meeting recording is disabled', ERROR_CODES.SYSTEM.ERROR);
  }

  if (!authToken) {
    throw new ApiError(401, 'Missing bearer token for recording bot socket authentication', ERROR_CODES.AUTH.AUTH_MISSING);
  }

  const meeting = await getAuthorizedMeeting(meetingId, currentUser);
  if (recordingManager.hasActiveSession(meetingId) || meeting.bot_status === 'recording') {
    throw new ApiError(409, 'Recording is already active for this meeting', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }
  if (meeting.bot_status === 'processing') {
    throw new ApiError(409, 'Recording is still being processed', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  const startedAt = new Date();
  const updated = await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'recording',
      recording_startedat: startedAt,
      recording_endedat: null,
      recording_error: null,
      recording_metadata: {
        stage: 'recording',
        startedBy: currentUser.username,
        maxRecordingMinutes: getMaxRecordingMinutes(),
      },
    },
  });

  try {
    await recordingManager.startRecording({
      meeting: updated,
      authToken,
      serverUrl: getServerUrl(),
      maxDurationMs: getMaxRecordingMinutes() * 60 * 1000,
      onMaxDuration: () => handleMaxDurationReached(meetingId, currentUser.username),
    });
    return buildRecordingStatus(updated);
  } catch (error) {
    const failed = await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        bot_status: 'failed',
        recording_error: sanitizeError(error),
        recording_endedat: new Date(),
        recording_metadata: {
          stage: 'failed',
          errorStage: 'recording',
          startedBy: currentUser.username,
        },
      },
    });
    throw new ApiError(500, failed.recording_error, ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR);
  }
};

const stopRecording = async (meetingId, currentUser) => {
  const meeting = await getAuthorizedMeeting(meetingId, currentUser);
  if (!recordingManager.hasActiveSession(meetingId) && meeting.bot_status !== 'recording') {
    throw new ApiError(409, 'No active recording session found for this meeting', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  const processing = await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'processing',
      recording_endedat: new Date(),
      recording_error: null,
    },
  });

  let stopResult;
  try {
    stopResult = await recordingManager.stopRecording(meetingId);
  } catch (error) {
    const failed = await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        bot_status: 'failed',
        recording_error: sanitizeError(error),
        recording_endedat: new Date(),
      },
    });
    throw new ApiError(500, failed.recording_error, ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR);
  }

  await runProcessingJob({ meetingId, stopResult, createby: currentUser.username });

  return buildRecordingStatus(processing);
};

const reprocessRecording = async (meetingId, currentUser) => {
  const meeting = await getAuthorizedMeeting(meetingId, currentUser);
  if (recordingManager.hasActiveSession(meetingId) || meeting.bot_status === 'recording') {
    throw new ApiError(409, 'Stop the active recording before reprocessing', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }
  if (meeting.bot_status === 'processing') {
    throw new ApiError(409, 'Recording is already being processed', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  const processing = await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'processing',
      recording_error: null,
      recording_metadata: {
        stage: 'reprocess_queued',
        requestedBy: currentUser.username,
      },
    },
  });

  const job = recordingProcessor.reprocessMeetingRecording({
    meetingId,
    createby: currentUser.username,
  }).catch(async (error) => {
    console.error('Recording reprocess job failed:', error.message);
    await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: { bot_status: 'failed', recording_error: sanitizeError(error) },
    }).catch(() => undefined);
  });

  if (process.env.RECORDING_PROCESS_SYNC === 'true') {
    await job;
    const updated = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
    return buildRecordingStatus(updated || processing);
  }

  return buildRecordingStatus(processing);
};

const uploadRecordingToDrive = async (meetingId, currentUser) => {
  const meeting = await getAuthorizedMeeting(meetingId, currentUser);
  if (recordingManager.hasActiveSession(meetingId) || meeting.bot_status === 'recording') {
    throw new ApiError(409, 'Stop the active recording before uploading', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }
  if (meeting.bot_status === 'processing') {
    throw new ApiError(409, 'Recording is still being processed', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  // Recording uploads use the uploader's own connected Google Drive (per-user
  // token), consistent with file attachments.
  const user = await prisma.user.findFirst({
    where: { username: currentUser.username },
    select: { googleDriveRefreshToken: true },
  });
  let refreshToken = null;
  try {
    refreshToken = decryptSecret(user?.googleDriveRefreshToken);
  } catch (error) {
    throw new ApiError(409, 'Google Drive connection is invalid. Please reconnect your Google Drive.', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }
  if (!refreshToken) {
    throw new ApiError(409, 'Connect your Google Drive before uploading the recording.', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  try {
    const result = await recordingProcessor.uploadLocalRecordingToDrive({ meetingId, refreshToken });
    return buildRecordingStatus(result.meeting);
  } catch (error) {
    const message = sanitizeError(error);
    if (/local recording file is not available/i.test(message)) {
      throw new ApiError(409, message, ERROR_CODES.SYSTEM.BAD_REQUEST);
    }
    throw new ApiError(500, message, ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR);
  }
};

const getRecordingStatus = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) throw new ApiError(404, 'Meeting not found');

  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const isParticipant = meeting.participants.includes(currentUser.username);
  const isOrganizer = meeting.organizer === currentUser.username;

  if (!isLeader && !isOrganizer && !isParticipant) {
    throw new ApiError(403, 'Access denied. You are not a participant in this meeting.', ERROR_CODES.AUTH.AUTH_ERROR);
  }

  return buildRecordingStatus(meeting);
};

const resetStaleRecordingMeetings = async () => {
  const now = new Date();
  const result = await prisma.meeting.updateMany({
    where: { bot_status: 'recording' },
    data: {
      bot_status: 'failed',
      recording_error: 'server restarted during recording',
      recording_endedat: now,
      recording_metadata: {
        stage: 'failed',
        errorStage: 'recording',
        reason: 'server restarted during recording',
        processingEndedAt: now.toISOString(),
      },
    },
  });

  if (result.count > 0) {
    console.warn(`Reset ${result.count} stale recording meeting(s) after backend startup.`);
  }

  return result.count;
};

module.exports = {
  startRecording,
  stopRecording,
  reprocessRecording,
  uploadRecordingToDrive,
  getRecordingStatus,
  resetStaleRecordingMeetings,
};
