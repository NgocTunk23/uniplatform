process.env.RECORDING_ENABLED = 'true';
process.env.RECORDING_PROCESS_SYNC = 'true';

const mockMeeting = {
  meetingid: 'meeting_1',
  workspaceid: 'workspace_1',
  organizer: 'leader',
  participants: ['leader', 'member'],
  title: 'Vietnamese Recording Test',
  bot_status: 'idle',
  recording_file: null,
  recording_startedat: null,
  recording_endedat: null,
  recording_error: null,
};

const mockPrisma = {
  meeting: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
};

const mockSecret = {
  decryptSecret: jest.fn(),
  encryptSecret: jest.fn(),
};

const mockPermissionUtil = {
  getWorkspaceMembership: jest.fn(),
};

const mockRecordingManager = {
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  hasActiveSession: jest.fn(),
};

const mockRecordingProcessor = {
  processMeetingRecording: jest.fn(),
  reprocessMeetingRecording: jest.fn(),
  uploadLocalRecordingToDrive: jest.fn(),
};

jest.mock('../src/config/prisma', () => mockPrisma);
jest.mock('../src/utils/permission.util', () => mockPermissionUtil);
jest.mock('../src/utils/secret.util', () => mockSecret);
jest.mock('../src/services/recording-manager.service', () => mockRecordingManager);
jest.mock('../src/services/recording-processing.service', () => mockRecordingProcessor);

const recordingService = require('../src/services/meeting-recording.service');

describe('meeting-recording.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.meeting.findUnique.mockResolvedValue({ ...mockMeeting });
    mockPrisma.meeting.update.mockImplementation(async ({ data }) => ({ ...mockMeeting, ...data }));
    mockPrisma.meeting.updateMany.mockResolvedValue({ count: 0 });
    mockPermissionUtil.getWorkspaceMembership.mockResolvedValue({ isSystemAdmin: false, workspacerole: 'Member' });
    mockRecordingManager.startRecording.mockResolvedValue({ startedAt: new Date() });
    mockRecordingManager.stopRecording.mockResolvedValue({
      audioPath: '/tmp/uniplatform-recording-test.wav',
      cleanup: ['/tmp/uniplatform-recording-test'],
      captureMetadata: {
        trackCount: 1,
        qualityWarnings: [],
        tracks: [{ id: 'socket-track', speechSeconds: 10 }],
      },
    });
    mockRecordingManager.hasActiveSession.mockReturnValue(false);
    mockRecordingProcessor.processMeetingRecording.mockResolvedValue({ ok: true });
    mockRecordingProcessor.reprocessMeetingRecording.mockResolvedValue({ ok: true });
    mockRecordingProcessor.uploadLocalRecordingToDrive.mockResolvedValue({
      meeting: { ...mockMeeting, recording_file: 'drive_recording_1' },
      recordingFileId: 'drive_recording_1',
    });
  });

  test('organizer can start recording', async () => {
    const status = await recordingService.startRecording(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' },
      'jwt-token'
    );

    expect(status.bot_status).toBe('recording');
    expect(mockRecordingManager.startRecording).toHaveBeenCalledWith(expect.objectContaining({
      authToken: 'jwt-token',
      meeting: expect.objectContaining({ bot_status: 'recording' }),
      maxDurationMs: 180 * 60 * 1000,
      onMaxDuration: expect.any(Function),
    }));
  });

  test('duplicate active recording is rejected', async () => {
    mockRecordingManager.hasActiveSession.mockReturnValue(true);

    await expect(recordingService.startRecording(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' },
      'jwt-token'
    )).rejects.toMatchObject({ statusCode: 409 });
  });

  test('regular workspace member cannot manage recording', async () => {
    await expect(recordingService.startRecording(
      mockMeeting.meetingid,
      { username: 'member', role: 'Member' },
      'jwt-token'
    )).rejects.toMatchObject({ statusCode: 403 });
  });

  test('stop recording moves to processing and runs processing job', async () => {
    mockRecordingManager.hasActiveSession.mockReturnValue(true);

    const status = await recordingService.stopRecording(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' }
    );

    expect(status.bot_status).toBe('processing');
    expect(mockRecordingManager.stopRecording).toHaveBeenCalledWith(mockMeeting.meetingid);
    expect(mockRecordingProcessor.processMeetingRecording).toHaveBeenCalledWith(expect.objectContaining({
      meetingId: mockMeeting.meetingid,
      audioPath: '/tmp/uniplatform-recording-test.wav',
      captureMetadata: expect.objectContaining({ trackCount: 1 }),
      createby: 'leader',
    }));
  });

  test('organizer can reprocess a failed recording', async () => {
    mockPrisma.meeting.findUnique
      .mockResolvedValueOnce({ ...mockMeeting, bot_status: 'failed', recording_file: 'drive_recording_1' })
      .mockResolvedValueOnce({ ...mockMeeting, bot_status: 'completed', recording_file: 'drive_recording_1' });

    const status = await recordingService.reprocessRecording(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' }
    );

    expect(status.bot_status).toBe('completed');
    expect(mockRecordingProcessor.reprocessMeetingRecording).toHaveBeenCalledWith({
      meetingId: mockMeeting.meetingid,
      createby: 'leader',
    });
  });

  test('organizer can upload retained local recording to their connected Drive', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValueOnce({
      ...mockMeeting,
      bot_status: 'review_required',
      recording_metadata: {
        localRecording: { status: 'available', mixedPath: '/tmp/meeting.wav' },
      },
    });
    mockPrisma.user.findFirst.mockResolvedValueOnce({ googleDriveRefreshToken: 'enc-token' });
    mockSecret.decryptSecret.mockReturnValueOnce('user-refresh-token');

    const status = await recordingService.uploadRecordingToDrive(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' }
    );

    expect(status.recording_file).toBe('drive_recording_1');
    expect(mockRecordingProcessor.uploadLocalRecordingToDrive).toHaveBeenCalledWith({
      meetingId: mockMeeting.meetingid,
      refreshToken: 'user-refresh-token',
    });
  });

  test('upload to Drive fails clearly when the user has not connected Drive', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValueOnce({
      ...mockMeeting,
      bot_status: 'review_required',
      recording_metadata: {
        localRecording: { status: 'available', mixedPath: '/tmp/meeting.wav' },
      },
    });
    mockPrisma.user.findFirst.mockResolvedValueOnce({ googleDriveRefreshToken: null });
    mockSecret.decryptSecret.mockReturnValueOnce(null);

    await expect(recordingService.uploadRecordingToDrive(
      mockMeeting.meetingid,
      { username: 'leader', role: 'Member' }
    )).rejects.toMatchObject({ statusCode: 409 });

    expect(mockRecordingProcessor.uploadLocalRecordingToDrive).not.toHaveBeenCalled();
  });

  test('startup cleanup marks stale recording meetings as failed', async () => {
    mockPrisma.meeting.updateMany.mockResolvedValue({ count: 2 });

    const count = await recordingService.resetStaleRecordingMeetings();

    expect(count).toBe(2);
    expect(mockPrisma.meeting.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bot_status: 'recording' },
      data: expect.objectContaining({
        bot_status: 'failed',
        recording_error: 'server restarted during recording',
      }),
    }));
  });
});
