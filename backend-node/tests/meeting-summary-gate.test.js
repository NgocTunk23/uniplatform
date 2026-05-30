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

  test('publishes final summary when Ragas score passes', async () => {
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

    expect(mockOllama.summarizeMeetingTranscript).toHaveBeenCalledWith('corrected transcript', baseMeeting.title);
    expect(mockSummaryEvaluation.evaluateSummarizationScore).toHaveBeenCalledWith(expect.objectContaining({
      referenceContexts: ['corrected transcript'],
      response: 'Nhóm thống nhất hoàn tất bản ghi âm.',
    }));
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: 'Nhóm thống nhất hoàn tất bản ghi âm.',
        summary_draft: null,
        summary_review_status: 'passed',
        summary_eval_score: 0.82,
        decisions: ['Hoàn tất bản ghi âm'],
        task: ['Kiểm thử summary gate'],
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'completed' }),
    }));
    expect(result.published).toBe(true);
  });

  test('stores draft and clears final summary when Ragas score fails', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(buildMeeting({
      raw_transcript: 'raw',
      corrected_transcript: 'corrected transcript',
      transcript_review_status: 'approved',
      summary: 'Old final summary',
      decisions: ['old'],
      task: ['old'],
    }));
    mockSummaryEvaluation.evaluateSummarizationScore.mockResolvedValue({
      score: 0.31,
      passed: false,
      threshold: 0.55,
      metric: 'ragas_summary_score',
      model: 'qwen3:1.7b',
    });

    const result = await meetingService.generateMeetingSummary(meetingId, currentUser);

    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        summary: null,
        content: null,
        summary_draft: 'Nhóm thống nhất hoàn tất bản ghi âm.',
        summary_review_status: 'failed',
        summary_eval_score: 0.31,
        decisions: [],
        task: [],
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bot_status: 'summary_review_required' }),
    }));
    expect(result.published).toBe(false);
  });

  test('re-evaluate publishes edited summary when score passes', async () => {
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
    expect(result.published).toBe(true);
  });
});
