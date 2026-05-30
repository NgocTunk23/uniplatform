const meetingId = '507f1f77bcf86cd799439011';
const currentUser = { username: 'leader', role: 'Member' };

const baseMeeting = {
  meetingid: meetingId,
  workspaceid: '507f1f77bcf86cd799439012',
  title: 'Sprint Review',
  organizer: 'leader',
  participants: ['leader', 'member'],
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
};

const mockPermissionUtil = {
  getWorkspaceMembership: jest.fn(),
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
jest.mock('../src/services/ollama.service', () => mockOllama);
jest.mock('../src/services/summary-evaluation-client.service', () => mockSummaryEvaluation);

const meetingService = require('../src/services/meeting.service');
const flushSummaryJob = async () => {
  const job = meetingService._private.activeSummaryJobs.get(meetingId);
  if (job) await job;
};

const buildMeeting = (meetingMinute) => ({
  ...baseMeeting,
  meetingMinute,
});

describe('meeting summary review gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissionUtil.getWorkspaceMembership.mockResolvedValue({ isSystemAdmin: false, workspacerole: 'Leader' });
    mockPrisma.meeting.update.mockImplementation(async ({ data }) => ({ ...baseMeeting, ...data }));
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
    meetingService._private.activeSummaryJobs.clear();
    mockOllama.summarizeMeetingTranscript.mockResolvedValue({
      summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
      decisions: ['Hoàn tất bản ghi âm'],
      tasks: ['Kiểm thử summary gate'],
      notes: 'Ghi chú từ summary.',
    });
  });

  test('blocks summary generation until corrected transcript is approved', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected',
      transcript_review_status: 'draft',
    }));

    await expect(meetingService.generateMeetingSummary(meetingId, currentUser))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(mockOllama.summarizeMeetingTranscript).not.toHaveBeenCalled();
    expect(mockSummaryEvaluation.evaluateSummarizationScore).not.toHaveBeenCalled();
  });

  test('publishes the generated summary as completed and records Ragas score as advisory', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      decisions: [],
      task: [],
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.82,
      passed: true,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const result = await meetingService.generateMeetingSummary(meetingId, currentUser);

    expect(result).toEqual(expect.objectContaining({
      queued: true,
      status: 'pending',
      stage: 'generating',
      published: false,
    }));

    await flushSummaryJob();

    expect(mockOllama.summarizeMeetingTranscript).toHaveBeenCalledWith('corrected transcript', baseMeeting.title);
    // Summary is published immediately (passed) regardless of Ragas.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
        summary_draft: null,
        summary_review_status: 'passed',
        decisions: ['Hoàn tất bản ghi âm'],
        task: ['Kiểm thử summary gate'],
        summary_eval_metadata: expect.objectContaining({ stage: 'scoring' }),
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'completed' }),
    }));
    // Ragas score recorded advisory afterwards, without touching summary/status.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary_eval_score: 0.82,
        summary_eval_metadata: expect.objectContaining({ advisory: true, stage: 'scored' }),
      }),
    }));
  });

  test('keeps the summary completed even when the advisory Ragas score is low', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      decisions: [],
      task: [],
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.31,
      passed: false,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const result = await meetingService.generateMeetingSummary(meetingId, currentUser);
    expect(result.queued).toBe(true);
    await flushSummaryJob();

    // Summary stays published; it is NOT demoted to a draft on a low score.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
        summary_review_status: 'passed',
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'completed' }),
    }));
    expect(mockPrisma.meeting.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'summary_review_required' }),
    }));
    // Low score is still recorded as advisory.
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary_eval_score: 0.31,
        summary_eval_metadata: expect.objectContaining({ advisory: true }),
      }),
    }));
  });

  test('publishes summary as completed before Ragas resolves (advisory runs in background)', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      decisions: [],
      task: [],
    }));

    let resolveEval;
    mockSummaryEvaluation.evaluateSummarizationScore.mockReturnValue(new Promise((resolve) => {
      resolveEval = resolve;
    }));

    await meetingService.generateMeetingSummary(meetingId, currentUser);

    // Let the background job run generation + publish, then block on eval.
    await new Promise((resolve) => setImmediate(resolve));

    // Summary is already completed while Ragas is still pending.
    expect(mockSummaryEvaluation.evaluateSummarizationScore).toHaveBeenCalled();
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
        summary_review_status: 'passed',
        summary_eval_metadata: expect.objectContaining({ stage: 'scoring' }),
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'completed' }),
    }));

    resolveEval({
      score: 0.82,
      passed: true,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });
    await flushSummaryJob();

    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary_eval_score: 0.82,
        summary_eval_metadata: expect.objectContaining({ advisory: true, stage: 'scored' }),
      }),
    }));
  });

  test('duplicate generate returns pending response without enqueueing another job', async () => {
    let resolveSummary;
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      decisions: [],
      task: [],
    }));
    mockOllama.summarizeMeetingTranscript.mockReturnValue(new Promise((resolve) => {
      resolveSummary = resolve;
    }));

    const first = await meetingService.generateMeetingSummary(meetingId, currentUser);
    const second = await meetingService.generateMeetingSummary(meetingId, currentUser);

    expect(first.queued).toBe(true);
    expect(second.queued).toBe(true);
    expect(mockOllama.summarizeMeetingTranscript).not.toHaveBeenCalledTimes(2);

    resolveSummary({
      summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
      decisions: [],
      tasks: [],
      notes: '',
    });
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.82,
      passed: true,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });
    await flushSummaryJob();
    expect(mockOllama.summarizeMeetingTranscript).toHaveBeenCalledTimes(1);
  });

  test('queued re-evaluate publishes edited summary when score passes', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      summary_draft: 'Draft summary',
      decisions: [],
      task: [],
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.76,
      passed: true,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const result = await meetingService.evaluateMeetingSummary(meetingId, {
      summary: 'Edited summary',
      content: 'Edited notes',
      decisions: ['Decision A'],
      task: ['Task A'],
    }, currentUser);

    expect(result).toEqual(expect.objectContaining({
      queued: true,
      status: 'pending',
      stage: 'evaluating',
    }));
    await flushSummaryJob();

    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Edited summary',
        content: 'Edited notes',
        summary_draft: null,
        summary_review_status: 'passed',
        decisions: ['Decision A'],
        task: ['Task A'],
      }),
    }));
  });
});
