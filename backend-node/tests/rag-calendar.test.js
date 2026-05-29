jest.mock('../src/config/prisma', () => ({
  schedules: {
    findMany: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
  },
  meeting: {
    findMany: jest.fn(),
  },
  meetingMinutes: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}));

jest.mock('../src/services/ai.service', () => ({
  generateResponse: jest.fn().mockResolvedValue('AI fallback response'),
}));

const prisma = require('../src/config/prisma');
const aiService = require('../src/services/ai.service');
const {
  answerMostRecentMeetingSummary,
  answerCalendarQuestion,
  buildCalendarAnswer,
  processChatWithPrivacy,
  resolveCalendarRange,
} = require('../src/services/rag.service');

const user = { username: '2152392', role: 'Member' };
const now = new Date('2026-05-29T03:00:00.000Z');

describe('RAG calendar answers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.schedules.findMany.mockResolvedValue([]);
    prisma.workspace.findMany.mockResolvedValue([]);
    prisma.meeting.findMany.mockResolvedValue([]);
    prisma.meetingMinutes.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  test('resolves tomorrow using Asia/Ho_Chi_Minh day boundaries', () => {
    const range = resolveCalendarRange('What is my work schedule tomorrow?', now);

    expect(range.label).toBe('ngày mai');
    expect(range.start.toISOString()).toBe('2026-05-29T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-30T17:00:00.000Z');
  });

  test('resolves today using Asia/Ho_Chi_Minh day boundaries', () => {
    const range = resolveCalendarRange('Lịch hôm nay của tôi là gì?', now);

    expect(range.label).toBe('hôm nay');
    expect(range.start.toISOString()).toBe('2026-05-28T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-29T17:00:00.000Z');
  });

  test('resolves this week from Monday to next Monday', () => {
    const range = resolveCalendarRange('Which meetings are happening this week?', now);

    expect(range.label).toBe('tuần này');
    expect(range.start.toISOString()).toBe('2026-05-24T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-31T17:00:00.000Z');
  });

  test('builds empty tomorrow answer without unrelated future events', () => {
    const range = resolveCalendarRange('What is my work schedule tomorrow?', now);

    expect(buildCalendarAnswer(range, [])).toBe('Ngày mai bạn chưa có lịch làm việc hoặc cuộc họp nào.');
  });

  test('answers tomorrow with only matching personal schedules', async () => {
    prisma.schedules.findMany.mockResolvedValue([
      {
        title: 'Volunteer prep',
        starttime: new Date('2026-05-30T03:00:00.000Z'),
        endtime: new Date('2026-05-30T04:00:00.000Z'),
        type: 'busy',
      },
    ]);

    const answer = await answerCalendarQuestion(user, 'What is my work schedule tomorrow?', now);

    expect(answer).toContain('Lịch ngày mai của bạn');
    expect(answer).toContain('Volunteer prep');
    expect(answer).toContain('10:00-11:00');
    expect(answer).toContain('Lịch cá nhân - Busy');
    expect(answer).not.toContain('Research Reading');
  });

  test('answers tomorrow with visible meetings', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Sprint Planning',
        starttime: new Date('2026-05-30T06:00:00.000Z'),
        endtime: new Date('2026-05-30T07:00:00.000Z'),
        organizer: 'admin1',
        rsvpStatus: {},
        workspace: { name: 'Phòng Công tác Sinh viên' },
      },
    ]);

    const answer = await answerCalendarQuestion(user, 'What is my work schedule tomorrow?', now);

    expect(answer).toContain('Sprint Planning');
    expect(answer).toContain('13:00-14:00');
    expect(answer).toContain('Cuộc họp - Phòng Công tác Sinh viên');
  });

  test('sorts schedules and meetings together by start time', async () => {
    prisma.schedules.findMany.mockResolvedValue([
      {
        title: 'Afternoon focus',
        starttime: new Date('2026-05-30T08:00:00.000Z'),
        endtime: new Date('2026-05-30T09:00:00.000Z'),
        type: 'tentative',
      },
    ]);
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Morning sync',
        starttime: new Date('2026-05-30T02:00:00.000Z'),
        endtime: new Date('2026-05-30T03:00:00.000Z'),
        organizer: 'admin1',
        rsvpStatus: {},
        workspace: { name: 'Test 001' },
      },
    ]);

    const answer = await answerCalendarQuestion(user, 'What is my work schedule tomorrow?', now);

    expect(answer.indexOf('Morning sync')).toBeLessThan(answer.indexOf('Afternoon focus'));
  });

  test('excludes declined meetings for non-organizers', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Declined meeting',
        starttime: new Date('2026-05-30T02:00:00.000Z'),
        endtime: new Date('2026-05-30T03:00:00.000Z'),
        organizer: 'admin1',
        rsvpStatus: { [user.username]: 'declined' },
        workspace: { name: 'Test 001' },
      },
    ]);

    const answer = await answerCalendarQuestion(user, 'What is my work schedule tomorrow?', now);

    expect(answer).toBe('Ngày mai bạn chưa có lịch làm việc hoặc cuộc họp nào.');
  });

  test('processChatWithPrivacy returns deterministic calendar answer for tomorrow', async () => {
    prisma.schedules.findMany.mockResolvedValue([
      {
        title: 'Tomorrow task',
        starttime: new Date('2026-05-30T03:00:00.000Z'),
        endtime: new Date('2026-05-30T04:00:00.000Z'),
        type: 'busy',
      },
    ]);

    jest.useFakeTimers().setSystemTime(now);
    const answer = await processChatWithPrivacy(user, 'What is my work schedule tomorrow?', []);
    jest.useRealTimers();

    expect(answer).toContain('Tomorrow task');
    expect(answer).not.toBe('AI fallback response');
  });

  test('summarizes the most recent visible meeting from stored minutes', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Recent planning',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username, 'admin1'],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Discussed next sprint scope.',
          decisions: ['Approve launch plan'],
          task: ['Prepare release checklist'],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { username: user.username, fullname: 'Nguyễn Võ Minh Anh' },
      { username: 'admin1', fullname: 'Admin One' },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toContain('Cuộc họp gần nhất: Recent planning');
    expect(answer).toContain('Thời gian: 28/05/2026 10:00-11:00');
    expect(answer).toContain('Người tham gia: Nguyễn Võ Minh Anh, Admin One');
    expect(answer).toContain('Tóm tắt: Discussed next sprint scope.');
    expect(answer).toContain('1. Approve launch plan');
    expect(answer).toContain('1. Prepare release checklist');
  });

  test('meeting summary query restricts regular members to meetings they participate in', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);

    await answerMostRecentMeetingSummary(user);

    expect(prisma.meeting.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            AND: expect.arrayContaining([
              { participants: { has: user.username } },
            ]),
          }),
        ]),
      }),
    }));
  });

  test('workspace leaders can summarize workspace meetings even when not participants', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Leader' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        title: 'Leader-visible meeting',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: ['admin1'],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Leader can review this meeting.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toContain('Leader-visible meeting');
    expect(answer).toContain('Tóm tắt: Leader can review this meeting.');
  });

  test('declined meeting is excluded for non-organizers', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Declined meeting minutes',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username, 'admin1'],
        rsvpStatus: { [user.username]: 'declined' },
        meetingMinute: {
          summary: 'Should be hidden.',
          decisions: ['Hidden decision'],
          task: ['Hidden task'],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toBe('Bạn chưa có biên bản cuộc họp nào để tóm tắt.');
  });

  test('organizer can summarize their own declined meeting', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Organizer meeting',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: user.username,
        participants: [user.username, 'admin1'],
        rsvpStatus: { [user.username]: 'declined' },
        meetingMinute: {
          summary: 'Organizer still sees this.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toContain('Organizer meeting');
    expect(answer).toContain('Tóm tắt: Organizer still sees this.');
  });

  test('chooses latest meeting by start time before minutes creation time', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Older meeting with newer minutes',
        starttime: new Date('2026-05-27T03:00:00.000Z'),
        endtime: new Date('2026-05-27T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Older meeting.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-29T05:00:00.000Z'),
        },
      },
      {
        title: 'Latest meeting',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Latest by meeting time.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toContain('Cuộc họp gần nhất: Latest meeting');
  });

  test('falls back to minutes creation time when meeting start times match', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'First minutes',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Older minutes.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
      {
        title: 'Second minutes',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Newer minutes.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T06:00:00.000Z'),
        },
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toContain('Cuộc họp gần nhất: Second minutes');
  });

  test('returns no-minutes message when no visible meeting minutes exist', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Meeting without minutes',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: null,
      },
    ]);

    const answer = await answerMostRecentMeetingSummary(user);

    expect(answer).toBe('Bạn chưa có biên bản cuộc họp nào để tóm tắt.');
  });

  test('processChatWithPrivacy returns deterministic meeting summary without Ollama', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        workspaceid: 'workspace-1',
        member: [{ username: user.username, workspacerole: 'Member' }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([
      {
        title: 'Deterministic summary',
        starttime: new Date('2026-05-28T03:00:00.000Z'),
        endtime: new Date('2026-05-28T04:00:00.000Z'),
        organizer: 'admin1',
        participants: [user.username],
        rsvpStatus: {},
        meetingMinute: {
          summary: 'Stored summary.',
          decisions: [],
          task: [],
          createdat: new Date('2026-05-28T05:00:00.000Z'),
        },
      },
    ]);

    const answer = await processChatWithPrivacy(user, 'Summarize my most recent meeting', []);

    expect(answer).toContain('Deterministic summary');
    expect(answer).not.toBe('AI fallback response');
    expect(aiService.generateResponse).not.toHaveBeenCalled();
  });
});
