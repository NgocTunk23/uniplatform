const aiService = require('./ai.service');
const prisma = require('../config/prisma');
const ROLES = require('../constants/roles');

const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VI_LOCALE = 'vi-VN';
const LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;

const normalizeText = (text = '') => text.toLowerCase();

const getLocalDateParts = (date = new Date()) => {
  const local = new Date(date.getTime() + LOCAL_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    date: local.getUTCDate(),
    day: local.getUTCDay(),
  };
};

const localDateToUtc = (year, month, date, hour = 0, minute = 0) => (
  new Date(Date.UTC(year, month, date, hour, minute, 0, 0) - LOCAL_OFFSET_MS)
);

const addLocalDays = (parts, days) => {
  const localNoon = Date.UTC(parts.year, parts.month, parts.date + days, 12, 0, 0, 0);
  const shifted = new Date(localNoon);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
  };
};

const buildDayRange = (parts, label, emptyMessage) => ({
  label,
  start: localDateToUtc(parts.year, parts.month, parts.date),
  end: localDateToUtc(parts.year, parts.month, parts.date + 1),
  emptyMessage,
});

const buildWeekRange = (baseParts, label) => {
  const mondayOffset = (baseParts.day + 6) % 7;
  const monday = addLocalDays(baseParts, -mondayOffset);
  return {
    label,
    start: localDateToUtc(monday.year, monday.month, monday.date),
    end: localDateToUtc(monday.year, monday.month, monday.date + 7),
    emptyMessage: `${label[0].toUpperCase()}${label.slice(1)} bạn chưa có lịch làm việc hoặc cuộc họp nào.`,
  };
};

const resolveCalendarRange = (prompt, now = new Date()) => {
  const text = normalizeText(prompt);
  const today = getLocalDateParts(now);

  if (text.includes('next week') || text.includes('tuần sau') || text.includes('tuan sau')) {
    return buildWeekRange(addLocalDays(today, 7), 'tuần sau');
  }

  if (text.includes('this week') || text.includes('tuần này') || text.includes('tuan nay')) {
    return buildWeekRange(today, 'tuần này');
  }

  if (text.includes('tomorrow') || text.includes('ngày mai') || text.includes('ngay mai')) {
    return buildDayRange(addLocalDays(today, 1), 'ngày mai', 'Ngày mai bạn chưa có lịch làm việc hoặc cuộc họp nào.');
  }

  if (text.includes('today') || text.includes('hôm nay') || text.includes('hom nay')) {
    return buildDayRange(today, 'hôm nay', 'Hôm nay bạn chưa có lịch làm việc hoặc cuộc họp nào.');
  }

  return null;
};

const isCalendarQuestion = (prompt) => {
  const text = normalizeText(prompt);
  const asksCalendar =
    text.includes('work schedule') ||
    text.includes('schedule') ||
    text.includes('lịch') ||
    text.includes('lich') ||
    text.includes('happening') ||
    text.includes('diễn ra') ||
    text.includes('dien ra');

  const hasCalendarEntity =
    text.includes('meeting') ||
    text.includes('họp') ||
    text.includes('hop') ||
    text.includes('schedule') ||
    text.includes('lịch') ||
    text.includes('lich');

  return asksCalendar && hasCalendarEntity && Boolean(resolveCalendarRange(prompt));
};

const formatDate = (date) => new Intl.DateTimeFormat(VI_LOCALE, {
  timeZone: DEFAULT_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(date);

const formatTime = (date) => new Intl.DateTimeFormat(VI_LOCALE, {
  timeZone: DEFAULT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date);

const formatRangeTime = (start, end, includeDate) => {
  const prefix = includeDate ? `${formatDate(start)} ` : '';
  return `${prefix}${formatTime(start)}-${formatTime(end)}`;
};

const scheduleTypeLabel = (type) => {
  if (type === 'tentative') return 'Tentative';
  if (type === 'busy') return 'Busy';
  return type || 'Lịch cá nhân';
};

const buildCalendarAnswer = (range, events) => {
  if (events.length === 0) {
    return range.emptyMessage;
  }

  const includeDate = range.label.includes('tuần');
  const lines = events.map((event, index) => {
    const sourceLabel = event.source === 'meeting'
      ? `Cuộc họp${event.workspaceName ? ` - ${event.workspaceName}` : ''}`
      : `Lịch cá nhân - ${scheduleTypeLabel(event.type)}`;
    return `${index + 1}. ${formatRangeTime(event.start, event.end, includeDate)}: ${event.title} (${sourceLabel})`;
  });

  return `Lịch ${range.label} của bạn:\n${lines.join('\n')}`;
};

const getVisibleMeetingQuery = async (currentUser, filter = {}) => {
  if (currentUser.role === ROLES.SYSTEM.ADMIN) {
    return filter;
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      member: {
        some: { username: currentUser.username },
      },
    },
    select: { workspaceid: true, member: true },
  });

  const leaderWorkspaceIds = workspaces
    .filter(w => w.member.some(m => m.username === currentUser.username && m.workspacerole === ROLES.WORKSPACE.LEADER))
    .map(w => w.workspaceid);

  const participantWorkspaceIds = workspaces
    .filter(w => !leaderWorkspaceIds.includes(w.workspaceid))
    .map(w => w.workspaceid);

  return {
    ...filter,
    OR: [
      { workspaceid: { in: leaderWorkspaceIds } },
      {
        AND: [
          { workspaceid: { in: participantWorkspaceIds } },
          { participants: { has: currentUser.username } },
        ],
      },
    ],
  };
};

const isMeetingVisibleToUser = (meeting, currentUser) => {
  const isOrganizer = meeting.organizer === currentUser.username;
  const rsvpStatus = meeting.rsvpStatus && typeof meeting.rsvpStatus === 'object'
    ? meeting.rsvpStatus[currentUser.username]
    : undefined;
  return isOrganizer || rsvpStatus !== 'declined';
};

const fetchCalendarEvents = async (currentUser, range) => {
  const meetingFilter = {
    starttime: { gte: range.start, lt: range.end },
  };

  const [schedules, meetings] = await Promise.all([
    prisma.schedules.findMany({
      where: {
        username: currentUser.username,
        starttime: { lt: range.end },
        endtime: { gt: range.start },
      },
      orderBy: { starttime: 'asc' },
    }),
    getVisibleMeetingQuery(currentUser, meetingFilter).then(where => prisma.meeting.findMany({
      where,
      include: {
        workspace: { select: { name: true } },
      },
      orderBy: { starttime: 'asc' },
    })),
  ]);

  const scheduleEvents = schedules.map(schedule => ({
    source: 'schedule',
    title: schedule.title,
    start: schedule.starttime,
    end: schedule.endtime,
    type: schedule.type,
  }));

  const meetingEvents = meetings
    .filter(meeting => isMeetingVisibleToUser(meeting, currentUser))
    .map(meeting => ({
      source: 'meeting',
      title: meeting.title,
      start: meeting.starttime,
      end: meeting.endtime,
      workspaceName: meeting.workspace?.name,
    }));

  return [...scheduleEvents, ...meetingEvents]
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

const answerCalendarQuestion = async (currentUser, prompt, now = new Date()) => {
  const range = resolveCalendarRange(prompt, now);
  if (!range) return null;

  const events = await fetchCalendarEvents(currentUser, range);
  return buildCalendarAnswer(range, events);
};

const isMeetingSummaryQuestion = (prompt) => {
  const text = normalizeText(prompt);
  const hasSummaryIntent =
    text.includes('summarize') ||
    text.includes('summary') ||
    text.includes('tóm tắt') ||
    text.includes('tom tat') ||
    text.includes('biên bản') ||
    text.includes('bien ban');

  const hasMeetingEntity =
    text.includes('meeting') ||
    text.includes('cuộc họp') ||
    text.includes('cuoc hop') ||
    text.includes('họp') ||
    text.includes('hop') ||
    text.includes('biên bản') ||
    text.includes('bien ban');

  const asksRecent =
    text.includes('most recent') ||
    text.includes('latest') ||
    text.includes('recent') ||
    text.includes('gần nhất') ||
    text.includes('gan nhat') ||
    text.includes('gần đây') ||
    text.includes('gan day');

  return hasSummaryIntent && hasMeetingEntity && asksRecent;
};

const listText = (items) => {
  const cleanItems = (items || []).map(item => String(item).trim()).filter(Boolean);
  if (cleanItems.length === 0) return 'Không có';
  return cleanItems.map((item, index) => `${index + 1}. ${item}`).join('\n');
};

const getParticipantNames = async (participants = []) => {
  const usernames = [...new Set(participants.filter(Boolean))];
  if (usernames.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { username: true, fullname: true },
  });
  const userMap = new Map(users.map(user => [user.username, user.fullname || user.username]));
  return usernames.map(username => userMap.get(username) || username);
};

const meetingHasVisibleMinutes = (meeting, currentUser) => {
  if (!meeting.meetingMinute) return false;
  const isOrganizer = meeting.organizer === currentUser.username;
  const rsvpStatus = meeting.rsvpStatus && typeof meeting.rsvpStatus === 'object'
    ? meeting.rsvpStatus[currentUser.username]
    : undefined;
  return isOrganizer || rsvpStatus !== 'declined';
};

const compareMeetingsByRecency = (a, b) => {
  const startDiff = new Date(b.starttime).getTime() - new Date(a.starttime).getTime();
  if (startDiff !== 0) return startDiff;

  const aMinutesCreated = a.meetingMinute?.createdat ? new Date(a.meetingMinute.createdat).getTime() : 0;
  const bMinutesCreated = b.meetingMinute?.createdat ? new Date(b.meetingMinute.createdat).getTime() : 0;
  return bMinutesCreated - aMinutesCreated;
};

const buildMeetingSummaryAnswer = async (meeting) => {
  const minutes = meeting.meetingMinute;
  const participantNames = await getParticipantNames(meeting.participants || []);

  return [
    `Cuộc họp gần nhất: ${meeting.title}`,
    `Thời gian: ${formatDate(meeting.starttime)} ${formatTime(meeting.starttime)}-${formatTime(meeting.endtime)}`,
    `Người tham gia: ${participantNames.length > 0 ? participantNames.join(', ') : 'Không có'}`,
    `Tóm tắt: ${String(minutes.summary || '').trim() || 'Chưa có tóm tắt'}`,
    `Quyết định:\n${listText(minutes.decisions)}`,
    `Việc cần làm:\n${listText(minutes.task)}`,
  ].join('\n');
};

const answerMostRecentMeetingSummary = async (currentUser) => {
  const where = await getVisibleMeetingQuery(currentUser);
  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      meetingMinute: true,
      workspace: { select: { name: true } },
    },
    orderBy: { starttime: 'desc' },
  });

  const meeting = meetings
    .filter(candidate => meetingHasVisibleMinutes(candidate, currentUser))
    .sort(compareMeetingsByRecency)[0];

  if (!meeting) {
    return 'Bạn chưa có biên bản cuộc họp nào để tóm tắt.';
  }

  return await buildMeetingSummaryAnswer(meeting);
};

const buildPrivacyFallbackResponse = (prompt = '') => {
  const text = normalizeText(prompt);

  if (text.includes('schedule') || text.includes('lịch') || text.includes('lich')) {
    return 'Tôi đang gặp sự cố khi truy xuất lịch của bạn. Vui lòng thử lại sau hoặc kiểm tra lịch trực tiếp trong ứng dụng để xem các sự kiện ngày mai.';
  }

  if (text.includes('meeting') || text.includes('họp') || text.includes('hop') || text.includes('biên bản') || text.includes('bien ban')) {
    if (text.includes('this week') || text.includes('tuần này') || text.includes('tuan nay') || text.includes('week')) {
      return 'Tôi không thể lấy danh sách cuộc họp tuần này ngay lúc này. Vui lòng thử lại sau hoặc kiểm tra lịch cuộc họp trong ứng dụng.';
    }
  }

  return 'Tôi đang gặp lỗi khi truy xuất dữ liệu an toàn của bạn. Vui lòng thử lại sau hoặc kiểm tra trực tiếp trong ứng dụng.';
};

/**
 * Trích xuất Lịch trình của người dùng hiện tại (Bảo mật 100%)
 */
const fetchUserSchedules = async (username) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = await prisma.schedules.findMany({
    where: { 
      username: username, // KHOÁ BẢO MẬT: Chỉ lấy lịch của đúng username này
      starttime: { gte: today } 
    },
    orderBy: { starttime: 'asc' },
    take: 5 // Lấy 5 sự kiện sắp tới
  });

  if (schedules.length === 0) return "Không có lịch trình nào sắp tới.";
  
  return schedules.map(s => 
    `- [${s.type}] ${s.title}: Từ ${s.starttime.toLocaleString('vi-VN')} đến ${s.endtime.toLocaleString('vi-VN')} (${s.description || 'Không có mô tả'})`
  ).join('\n');
};

/**
 * Trích xuất các cuộc họp sắp tới của người dùng hiện tại (theo phạm vi truy cập của user)
 */
const fetchUserMeetings = async (currentUser) => {
  const where = await getVisibleMeetingQuery(currentUser, {
    starttime: { gte: new Date() },
  });

  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      workspace: { select: { name: true } },
    },
    orderBy: { starttime: 'asc' },
    take: 5,
  });

  const visibleMeetings = meetings.filter(meeting => isMeetingVisibleToUser(meeting, currentUser));

  if (visibleMeetings.length === 0) return "Không tìm thấy cuộc họp nào sắp tới cho bạn.";

  return visibleMeetings.map(meeting =>
    `- ${meeting.title}: ${formatDate(meeting.starttime)} ${formatTime(meeting.starttime)}-${formatTime(meeting.endtime)}${meeting.workspace?.name ? ` (${meeting.workspace.name})` : ''}`
  ).join('\n');
};

/**
 * Main Logic: Phân tích intent và gắn Context an toàn trước khi gọi Ollama
 */
const processChatWithPrivacy = async (user, prompt, chatHistory) => {
  try {
    const username = user.username;
    // SỬA LẠI BASE PROMPT: Nới lỏng việc "không bịa đặt" thành "không bịa đặt dữ liệu CÁ NHÂN"
    let systemInstruction = "Bạn là trợ lý AI ảo của hệ thống UniPlatform tên là UniPlatform AI. Hãy trả lời ngắn gọn, thân thiện bằng tiếng Việt. Tuyệt đối không bịa đặt dữ liệu cá nhân của người dùng nếu không biết.";

    const promptLower = prompt.toLowerCase();

    // 1. Nhận diện ý định (Intent Recognition)
    const askForSchedule = promptLower.includes('lịch') || promptLower.includes('schedule') || promptLower.includes('ngày mai');
    const askForMeeting = promptLower.includes('họp') || promptLower.includes('biên bản') || promptLower.includes('meeting');

    if (isCalendarQuestion(prompt)) {
      const calendarAnswer = await answerCalendarQuestion(user, prompt);
      if (calendarAnswer) {
        return calendarAnswer;
      }
    }

    if (isMeetingSummaryQuestion(prompt)) {
      return await answerMostRecentMeetingSummary(user);
    }

    // 2. Thu thập dữ liệu bảo mật
    let injectedContext = "";
    if (askForSchedule) {
      const scheduleData = await fetchUserSchedules(username);
      injectedContext += `\n--- LỊCH TRÌNH CỦA [${username}] ---\n${scheduleData}\n`;
    }

    if (askForMeeting) {
      const meetingData = await fetchUserMeetings(user);
      injectedContext += `\n--- CUỘC HỌP CỦA [${username}] ---\n${meetingData}\n`;
    }

    // 3. SỬA LẠI SYSTEM PROMPT ĐỘNG: Hướng dẫn AI cách xử lý tình huống thông minh hơn
    if (injectedContext !== "") {
      systemInstruction += `

Bối cảnh thời gian hiện tại: ${new Date().toLocaleString(VI_LOCALE, { timeZone: DEFAULT_TIME_ZONE })} (${DEFAULT_TIME_ZONE}).

Hệ thống cung cấp dữ liệu riêng tư sau:
${injectedContext}

HƯỚNG DẪN TRẢ LỜI (QUAN TRỌNG):
1. Nếu câu hỏi liên quan đến lịch trình/biên bản cụ thể của người dùng: Dùng dữ liệu trên để trả lời.
2. NẾU câu hỏi là TƯ VẤN KIẾN THỨC CHUNG (ví dụ: "Giờ nào họp tốt nhất?", "Cách làm việc hiệu quả?"): BỎ QUA dữ liệu bị trống bên trên. Hãy tự do dùng kiến thức chung của bạn để tư vấn một cách tự nhiên, hữu ích nhất.`;
    }

    // 4. Gọi tầng AI Service
    const aiResponse = await aiService.generateResponse(prompt, chatHistory, systemInstruction);
    return aiResponse;

  } catch (error) {
    console.error('❌ RAG Service Error:', error.message);
    return buildPrivacyFallbackResponse(prompt);
  }
};

module.exports = {
  processChatWithPrivacy,
  resolveCalendarRange,
  buildCalendarAnswer,
  answerCalendarQuestion,
  answerMostRecentMeetingSummary,
};
