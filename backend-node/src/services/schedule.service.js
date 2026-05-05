const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const ROLES = require('../constants/roles');
const calendarConflictService = require('./calendar-conflict.service');

const toDate = (value) => (value ? new Date(value) : undefined);

const serializeSchedule = (schedule) => ({
  ...schedule,
  id: schedule.scheduleid,
});

const resolveTargetUsername = (currentUser, requestedUsername) => {
  if (currentUser.role === ROLES.SYSTEM.ADMIN && requestedUsername) {
    return requestedUsername;
  }
  return currentUser.username;
};

const assertCanAccessSchedule = (schedule, currentUser) => {
  if (!schedule) {
    throw new ApiError(404, 'Schedule not found', ERROR_CODES.SYSTEM.BAD_REQUEST);
  }

  if (currentUser.role === ROLES.SYSTEM.ADMIN || schedule.username === currentUser.username) {
    return;
  }

  throw new ApiError(403, 'You can only manage your own schedule', ERROR_CODES.AUTH.AUTH_ERROR);
};

const listSchedules = async (query, currentUser) => {
  const username = resolveTargetUsername(currentUser, query.username);
  const start = toDate(query.start);
  const end = toDate(query.end);

  const where = {
    username,
    type: query.type,
  };

  if (start && end) {
    where.starttime = { lt: end };
    where.endtime = { gt: start };
  } else if (start) {
    where.endtime = { gt: start };
  } else if (end) {
    where.starttime = { lt: end };
  }

  const schedules = await prisma.schedules.findMany({
    where,
    orderBy: { starttime: 'asc' },
  });

  return schedules.map(serializeSchedule);
};

const getScheduleById = async (scheduleId, currentUser) => {
  const schedule = await prisma.schedules.findUnique({
    where: { scheduleid: scheduleId },
  });

  assertCanAccessSchedule(schedule, currentUser);
  return serializeSchedule(schedule);
};

const createSchedule = async (data, currentUser) => {
  const starttime = toDate(data.starttime);
  const endtime = toDate(data.endtime);

  await calendarConflictService.assertNoCalendarConflicts({
    usernames: [currentUser.username],
    starttime,
    endtime,
  });

  const schedule = await prisma.schedules.create({
    data: {
      username: currentUser.username,
      title: data.title,
      description: data.description || undefined,
      starttime,
      endtime,
      type: data.type,
    },
  });

  return serializeSchedule(schedule);
};

const updateSchedule = async (scheduleId, data, currentUser) => {
  const existing = await prisma.schedules.findUnique({
    where: { scheduleid: scheduleId },
  });

  assertCanAccessSchedule(existing, currentUser);

  const starttime = data.starttime ? toDate(data.starttime) : existing.starttime;
  const endtime = data.endtime ? toDate(data.endtime) : existing.endtime;

  if (endtime <= starttime) {
    throw new ApiError(400, 'End time must be after start time', ERROR_CODES.VALIDATION.VALIDATION_ERROR);
  }

  await calendarConflictService.assertNoCalendarConflicts({
    usernames: [existing.username],
    starttime,
    endtime,
    excludeScheduleId: scheduleId,
  });

  const schedule = await prisma.schedules.update({
    where: { scheduleid: scheduleId },
    data: {
      title: data.title,
      description: data.description,
      starttime: data.starttime ? starttime : undefined,
      endtime: data.endtime ? endtime : undefined,
      type: data.type,
    },
  });

  return serializeSchedule(schedule);
};

const deleteSchedule = async (scheduleId, currentUser) => {
  const existing = await prisma.schedules.findUnique({
    where: { scheduleid: scheduleId },
  });

  assertCanAccessSchedule(existing, currentUser);

  await prisma.schedules.delete({
    where: { scheduleid: scheduleId },
  });
};

module.exports = {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
