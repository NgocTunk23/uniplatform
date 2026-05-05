const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

const BLOCKING_SCHEDULE_TYPES = ['busy', 'tentative'];

const uniqueUsernames = (usernames) => [...new Set((usernames || []).filter(Boolean))];

const findConflictingSchedules = async ({ usernames, starttime, endtime, excludeScheduleId }) => {
  const users = uniqueUsernames(usernames);
  if (users.length === 0) return [];

  const where = {
    username: { in: users },
    type: { in: BLOCKING_SCHEDULE_TYPES },
    starttime: { lt: endtime },
    endtime: { gt: starttime },
  };

  if (excludeScheduleId) {
    where.scheduleid = { not: excludeScheduleId };
  }

  return prisma.schedules.findMany({
    where,
    orderBy: { starttime: 'asc' },
  });
};

const findConflictingMeetings = async ({ usernames, starttime, endtime, excludeMeetingId }) => {
  const users = uniqueUsernames(usernames);
  if (users.length === 0) return [];

  const where = {
    status: { not: 'ended' },
    starttime: { lt: endtime },
    endtime: { gt: starttime },
    OR: [
      { organizer: { in: users } },
      { participants: { hasSome: users } },
    ],
  };

  if (excludeMeetingId) {
    where.meetingid = { not: excludeMeetingId };
  }

  return prisma.meeting.findMany({
    where,
    orderBy: { starttime: 'asc' },
  });
};

const getMeetingConflictUsers = (meeting, usernames) => {
  const users = uniqueUsernames(usernames);
  const participants = meeting.participants || [];
  return users.filter((username) => meeting.organizer === username || participants.includes(username));
};

const serializeScheduleConflict = (schedule) => ({
  source: 'schedule',
  id: schedule.scheduleid,
  title: schedule.title,
  usernames: [schedule.username],
  starttime: schedule.starttime,
  endtime: schedule.endtime,
  type: schedule.type,
});

const serializeMeetingConflict = (meeting, usernames) => ({
  source: 'meeting',
  id: meeting.meetingid,
  title: meeting.title,
  usernames: getMeetingConflictUsers(meeting, usernames),
  starttime: meeting.starttime,
  endtime: meeting.endtime,
  type: 'meeting',
});

const getCalendarConflicts = async ({ usernames, starttime, endtime, excludeScheduleId, excludeMeetingId }) => {
  const [schedules, meetings] = await Promise.all([
    findConflictingSchedules({ usernames, starttime, endtime, excludeScheduleId }),
    findConflictingMeetings({ usernames, starttime, endtime, excludeMeetingId }),
  ]);

  return [
    ...schedules.map(serializeScheduleConflict),
    ...meetings.map((meeting) => serializeMeetingConflict(meeting, usernames)),
  ].sort((a, b) => new Date(a.starttime).getTime() - new Date(b.starttime).getTime());
};

const listBlockingCalendarEvents = async ({ usernames, starttime, endtime, excludeMeetingId }) => {
  return getCalendarConflicts({ usernames, starttime, endtime, excludeMeetingId });
};

const assertNoCalendarConflicts = async ({ usernames, starttime, endtime, excludeScheduleId, excludeMeetingId }) => {
  const conflicts = await getCalendarConflicts({ usernames, starttime, endtime, excludeScheduleId, excludeMeetingId });
  if (conflicts.length === 0) return;

  const first = conflicts[0];
  const usersText = first.usernames.length > 0 ? first.usernames.join(', ') : 'selected users';
  const sourceText = first.source === 'schedule' ? 'schedule' : 'meeting';

  throw new ApiError(
    409,
    `Time overlaps with existing ${sourceText} "${first.title}" for ${usersText}`,
    ERROR_CODES.VALIDATION.VALIDATION_ERROR,
    true,
    '',
    { conflicts }
  );
};

module.exports = {
  assertNoCalendarConflicts,
  getCalendarConflicts,
  listBlockingCalendarEvents,
};
