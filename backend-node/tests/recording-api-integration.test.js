process.env.RECORDING_ENABLED = 'true';
process.env.RECORDING_PROCESS_SYNC = 'true';
process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');

const meetingId = '507f1f77bcf86cd799439011';
let mockCurrentUser = { username: 'leader', role: 'Member' };

const baseMeeting = {
  meetingid: meetingId,
  workspaceid: '507f1f77bcf86cd799439012',
  title: 'Vietnamese Recording Integration',
  organizer: 'leader',
  participants: ['leader', 'member'],
  bot_status: 'idle',
  recording_file: null,
  recording_error: null,
};

const mockPrisma = {
  meeting: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  meetingMinutes: {
    update: jest.fn(),
    upsert: jest.fn(),
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

const mockOllama = {
  correctMeetingTranscript: jest.fn(),
  summarizeMeetingTranscript: jest.fn(),
};

const mockSummaryEvaluation = {
  evaluateSummarizationScore: jest.fn(),
};

jest.mock('../src/config/prisma', () => mockPrisma);
jest.mock('../src/utils/permission.util', () => mockPermissionUtil);
jest.mock('../src/utils/secret.util', () => mockSecret);
jest.mock('../src/services/recording-manager.service', () => mockRecordingManager);
jest.mock('../src/services/recording-processing.service', () => mockRecordingProcessor);
jest.mock('../src/services/ollama.service', () => mockOllama);
jest.mock('../src/services/summary-evaluation-client.service', () => mockSummaryEvaluation);
jest.mock('../src/utils/gdrive.util', () => ({
  getDownloadLink: (fileId) => `https://drive.google.com/uc?export=download&id=${fileId}`,
}));
jest.mock('../src/middlewares/auth.middleware', () => ({
  protect: (req, _res, next) => {
    req.user = mockCurrentUser;
    next();
  },
}));

const meetingRoutes = require('../src/routes/meeting.routes');
const errorMiddleware = require('../src/middlewares/error.middleware');
const meetingService = require('../src/services/meeting.service');

const app = express();
app.use(express.json());
app.use('/api/meetings', meetingRoutes);
app.use(errorMiddleware);

const flushSummaryJob = async () => {
  const job = meetingService._private.activeSummaryJobs.get(meetingId);
  if (job) await job;
};

const buildMeeting = (overrides = {}) => ({
  ...baseMeeting,
  ...overrides,
});

describe('recording/transcription API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { username: 'leader', role: 'Member' };
    mockPermissionUtil.getWorkspaceMembership.mockResolvedValue({ isSystemAdmin: false, workspacerole: 'Leader' });
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting());
    mockPrisma.meeting.update.mockImplementation(async ({ data }) => buildMeeting(data));
    mockPrisma.meetingMinutes.update.mockImplementation(async ({ data }) => ({
      meetingminuteid: 'minutes_1',
      meetingid: meetingId,
      files: [],
      ...data,
    }));
    mockPrisma.meetingMinutes.upsert.mockImplementation(async ({ create, update }) => ({
      meetingminuteid: 'minutes_1',
      meetingid: meetingId,
      files: [],
      ...(create || update),
    }));
    mockRecordingManager.startRecording.mockResolvedValue({ startedAt: new Date() });
    mockRecordingManager.stopRecording.mockResolvedValue({
      audioPath: '/tmp/integration-meeting.wav',
      cleanup: ['/tmp/integration-recording'],
      captureMetadata: {
        trackCount: 1,
        qualityWarnings: ['low_volume'],
        tracks: [{ id: 'socket-track', speechSeconds: 12 }],
      },
    });
    mockRecordingManager.hasActiveSession.mockReturnValue(false);
    mockRecordingProcessor.processMeetingRecording.mockResolvedValue({ ok: true });
    mockRecordingProcessor.uploadLocalRecordingToDrive.mockResolvedValue({
      meeting: buildMeeting({ recording_file: 'drive_recording_1' }),
      recordingFileId: 'drive_recording_1',
    });
    mockPrisma.user.findFirst.mockResolvedValue({ googleDriveRefreshToken: 'enc-token' });
    mockSecret.decryptSecret.mockReturnValue('user-refresh-token');
    mockOllama.summarizeMeetingTranscript.mockResolvedValue({
      summary: 'Nhóm thống nhất xử lý transcript đã duyệt.',
      decisions: ['Duyệt transcript trước khi summary'],
      tasks: ['Kiểm thử Ragas gate'],
      notes: 'Ghi chú tích hợp.',
    });
    meetingService._private.activeSummaryJobs.clear();
  });

  test('start and stop recording through HTTP API', async () => {
    const startRes = await request(app)
      .post(`/api/meetings/${meetingId}/recording/start`)
      .set('Authorization', 'Bearer test-token');

    expect(startRes.status).toBe(202);
    expect(startRes.body.data.bot_status).toBe('recording');
    expect(mockRecordingManager.startRecording).toHaveBeenCalledWith(expect.objectContaining({
      authToken: 'test-token',
      meeting: expect.objectContaining({ bot_status: 'recording' }),
    }));

    mockPrisma.meeting.findUnique.mockResolvedValueOnce(buildMeeting({ bot_status: 'recording' }));
    mockRecordingManager.hasActiveSession.mockReturnValue(true);

    const stopRes = await request(app)
      .post(`/api/meetings/${meetingId}/recording/stop`)
      .set('Authorization', 'Bearer test-token');

    expect(stopRes.status).toBe(202);
    expect(stopRes.body.data.bot_status).toBe('processing');
    expect(mockRecordingProcessor.processMeetingRecording).toHaveBeenCalledWith(expect.objectContaining({
      meetingId,
      audioPath: '/tmp/integration-meeting.wav',
      captureMetadata: expect.objectContaining({
        trackCount: 1,
        qualityWarnings: ['low_volume'],
      }),
      createby: 'leader',
    }));
  });

  test('uploads retained local recording to Drive through HTTP API', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValueOnce(buildMeeting({
      bot_status: 'review_required',
      recording_metadata: {
        localRecording: { status: 'available', mixedPath: '/tmp/integration-meeting.wav' },
      },
    }));

    const res = await request(app)
      .post(`/api/meetings/${meetingId}/recording/upload-drive`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.recording_file).toBe('drive_recording_1');
    expect(res.body.data.recordingDownloadLink).toContain('drive_recording_1');
    expect(mockRecordingProcessor.uploadLocalRecordingToDrive).toHaveBeenCalledWith({ meetingId, refreshToken: 'user-refresh-token' });
  });

  test('review approved transcript and publish summary, Ragas score recorded advisory', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValueOnce(buildMeeting({
      meetingMinute: {
        raw_transcript: 'raw transcript',
        corrected_transcript: 'corrected transcript',
        transcript_review_status: 'draft',
      },
    }));

    const reviewRes = await request(app)
      .put(`/api/meetings/${meetingId}/transcript/review`)
      .send({
        corrected_transcript: 'Transcript đã được người dùng duyệt.',
        approve: true,
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.transcript_review_status).toBe('approved');

    mockPrisma.meeting.findUnique.mockResolvedValueOnce(buildMeeting({
      meetingMinute: {
        raw_transcript: 'raw transcript',
        corrected_transcript: 'Transcript đã được người dùng duyệt.',
        transcript_review_status: 'approved',
        decisions: [],
        task: [],
      },
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.82,
      passed: true,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const summaryRes = await request(app)
      .post(`/api/meetings/${meetingId}/summary/generate`);

    expect(summaryRes.status).toBe(202);
    expect(summaryRes.body.data.queued).toBe(true);
    expect(summaryRes.body.data.status).toBe('pending');
    await flushSummaryJob();
    // Published immediately as completed.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất xử lý transcript đã duyệt.',
        summary_review_status: 'passed',
        summary_eval_metadata: expect.objectContaining({ stage: 'scoring' }),
      }),
    }));
    // Ragas score recorded advisory afterwards.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary_eval_score: 0.82,
        summary_eval_metadata: expect.objectContaining({ advisory: true, stage: 'scored' }),
      }),
    }));
  });

  test('low advisory Ragas score does not block or demote the published summary', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      meetingMinute: {
        raw_transcript: 'raw transcript',
        corrected_transcript: 'Transcript đã được duyệt nhưng summary còn yếu.',
        transcript_review_status: 'approved',
        summary: 'old final',
        decisions: ['old'],
        task: ['old'],
      },
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.32,
      passed: false,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const res = await request(app)
      .post(`/api/meetings/${meetingId}/summary/generate`);

    expect(res.status).toBe(202);
    expect(res.body.data.queued).toBe(true);
    await flushSummaryJob();
    // Summary stays published despite the low score.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất xử lý transcript đã duyệt.',
        summary_review_status: 'passed',
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'completed' }),
    }));
    expect(mockPrisma.meeting.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'summary_review_required' }),
    }));
    // Low score still captured as advisory.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary_eval_score: 0.32,
        summary_eval_metadata: expect.objectContaining({ advisory: true }),
      }),
    }));
  });
});
