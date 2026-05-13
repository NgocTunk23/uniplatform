const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ROLES = require('../constants/roles');
const ERROR_CODES = require('../constants/error-codes');
const permissionUtil = require('../utils/permission.util');
const calendarConflictService = require('./calendar-conflict.service');
const gdriveUtil = require('../utils/gdrive.util');

const buildMeetingLink = () => `https://meet.uniplatform.com/${Math.random().toString(36).substring(2, 10)}`;

const normalizeParticipants = (participants, workspace, organizer) => {
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }

  const workspaceMembers = workspace.member || [];
  const allowedUsernames = new Set(workspaceMembers.map((member) => member.username));
  const requestedParticipants = participants && participants.length > 0 ? participants : [organizer];
  const deduped = [...new Set([...requestedParticipants, organizer])];
  const invalidParticipants = deduped.filter((username) => !allowedUsernames.has(username));

  if (invalidParticipants.length > 0) {
    throw new ApiError(400, `Participants must belong to the workspace: ${invalidParticipants.join(', ')}`);
  }

  return deduped;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

const roundUpToStep = (date, stepMinutes) => {
  const stepMs = stepMinutes * 60000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
};

const setTimeFromMinutes = (date, minutes) => {
  const copy = new Date(date);
  copy.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return copy;
};

const buildDailySearchWindows = (searchStart, searchEnd) => {
  const startMinute = minutesOfDay(searchStart);
  const endMinute = minutesOfDay(searchEnd);

  if (endMinute <= startMinute) {
    return [{ start: searchStart, end: searchEnd }];
  }

  const windows = [];
  const cursor = new Date(searchStart);
  cursor.setHours(0, 0, 0, 0);

  const finalDay = new Date(searchEnd);
  finalDay.setHours(0, 0, 0, 0);

  while (cursor <= finalDay) {
    const windowStart = setTimeFromMinutes(cursor, startMinute);
    const windowEnd = setTimeFromMinutes(cursor, endMinute);
    const actualStart = new Date(Math.max(windowStart.getTime(), searchStart.getTime()));
    const actualEnd = new Date(Math.min(windowEnd.getTime(), searchEnd.getTime()));

    if (actualEnd > actualStart) {
      windows.push({ start: actualStart, end: actualEnd });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return windows;
};

const eventOverlaps = (event, starttime, endtime) => {
  const eventStart = new Date(event.starttime);
  const eventEnd = new Date(event.endtime);
  return eventStart < endtime && eventEnd > starttime;
};

const findSlotConflicts = (blockingEvents, starttime, endtime, participants) => {
  const participantSet = new Set(participants);
  return blockingEvents.filter((event) => (
    (event.usernames || []).some((username) => participantSet.has(username)) &&
    eventOverlaps(event, starttime, endtime)
  ));
};

const scoreSlot = (slotStart, searchStart, index) => {
  const daysFromStart = Math.max(0, Math.floor((slotStart.getTime() - searchStart.getTime()) / 86400000));
  return Math.max(65, 100 - daysFromStart * 5 - index * 2);
};

const slotQuality = (score) => {
  if (score >= 90) return 'best';
  if (score >= 75) return 'good';
  return 'low';
};

const buildMinuteFileResponse = (file) => ({
  ...file,
  id: file.fileid,
  downloadLink: gdriveUtil.getDownloadLink(file.ggid),
  webViewLink: `https://drive.google.com/file/d/${file.ggid}/view`,
});

const serializeMeetingMinutes = (minutes) => {
  if (!minutes) return null;
  return {
    ...minutes,
    id: minutes.meetingminuteid,
    files: (minutes.files || []).map(buildMinuteFileResponse),
  };
};

const ensureCanManageMeeting = async (meeting, currentUser) => {
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const isOrganizer = meeting.organizer === currentUser.username;

  if (!isLeader && !isOrganizer) {
    throw new ApiError(403, 'Authority denied. Only Leaders or the Organizer can perform this action.');
  }
};

const getAllMeetings = async (currentUser) => {
  if (currentUser.role === ROLES.SYSTEM.ADMIN) {
    return await prisma.meeting.findMany({
      include: {
        workspace: { select: { name: true } },
        meetingMinute: true
      },
      orderBy: { starttime: 'desc' }
    });
  }

  // Get all workspaces the user is a member of
  const workspaces = await prisma.workspace.findMany({
    where: {
      member: {
        some: { username: currentUser.username }
      }
    },
    select: { workspaceid: true, member: true }
  });

  const leaderWorkspaceIds = workspaces
    .filter(w => w.member.some(m => m.username === currentUser.username && m.workspacerole === ROLES.WORKSPACE.LEADER))
    .map(w => w.workspaceid);

  const participantWorkspaceIds = workspaces
    .filter(w => !leaderWorkspaceIds.includes(w.workspaceid))
    .map(w => w.workspaceid);

  const query = {
    OR: [
      { workspaceid: { in: leaderWorkspaceIds } },
      {
        AND: [
          { workspaceid: { in: participantWorkspaceIds } },
          { participants: { has: currentUser.username } }
        ]
      }
    ]
  };

  return await prisma.meeting.findMany({
    where: query,
    include: {
      workspace: { select: { name: true } },
      meetingMinute: true
    },
    orderBy: { starttime: 'desc' }
  });
};

const getMeetingsByWorkspace = async (workspaceId, currentUser) => {
  const membership = await permissionUtil.getWorkspaceMembership(workspaceId, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;

  const query = { workspaceid: workspaceId };
  if (!isLeader) {
    query.participants = { has: currentUser.username };
  }

  return await prisma.meeting.findMany({
    where: query,
    include: {
      meetingMinute: true
    },
    orderBy: { starttime: 'desc' }
  });
};

const getMeetingById = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: {
      workspace: true,
      meetingMinute: true
    }
  });

  if (!meeting) return null;

  // Check if user is member of the workspace
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;

  // If not leader and not a participant, deny access
  if (!isLeader && !meeting.participants.includes(currentUser.username)) {
    throw new ApiError(403, 'Access denied. You are not a participant in this meeting.', ERROR_CODES.AUTH.AUTH_ERROR);
  }

  return meeting;
};

const createMeeting = async (meetingData, currentUser) => {
  await permissionUtil.ensureCanWrite(meetingData.workspaceid, currentUser);
  const workspace = await prisma.workspace.findUnique({
    where: { workspaceid: meetingData.workspaceid },
    select: { member: true }
  });

  const participants = normalizeParticipants(meetingData.participants, workspace, currentUser.username);
  const starttime = new Date(meetingData.starttime);
  const endtime = new Date(meetingData.endtime);

  if (!meetingData.force) {
    await calendarConflictService.assertNoCalendarConflicts({
      usernames: participants,
      starttime,
      endtime,
    });
  }

  return await prisma.meeting.create({
    data: {
      workspaceid: meetingData.workspaceid,
      title: meetingData.title,
      starttime,
      endtime,
      organizer: currentUser.username,
      participants,
      status: 'upcoming',
      link: meetingData.link || buildMeetingLink(),
      place: meetingData.place,
      bot_status: 'idle'
    }
  });
};

const suggestMeetingSlots = async (suggestData, currentUser) => {
  await permissionUtil.ensureCanWrite(suggestData.workspaceid, currentUser);

  const workspace = await prisma.workspace.findUnique({
    where: { workspaceid: suggestData.workspaceid },
    select: { member: true }
  });

  const participants = normalizeParticipants(suggestData.participants, workspace, currentUser.username);
  const searchStart = new Date(suggestData.searchStart);
  const searchEnd = new Date(suggestData.searchEnd);
  const durationMinutes = suggestData.durationMinutes;
  const stepMinutes = suggestData.stepMinutes || 30;
  const durationMs = durationMinutes * 60000;

  const blockingEvents = await calendarConflictService.listBlockingCalendarEvents({
    usernames: participants,
    starttime: searchStart,
    endtime: searchEnd,
  });

  const slots = [];
  const windows = buildDailySearchWindows(searchStart, searchEnd);

  for (const window of windows) {
    let slotStart = roundUpToStep(window.start, stepMinutes);

    while (slotStart.getTime() + durationMs <= window.end.getTime()) {
      const slotEnd = addMinutes(slotStart, durationMinutes);
      const conflicts = findSlotConflicts(blockingEvents, slotStart, slotEnd, participants);

      if (conflicts.length === 0) {
        const score = scoreSlot(slotStart, searchStart, slots.length);
        slots.push({
          id: `${slotStart.toISOString()}_${slotEnd.toISOString()}`,
          starttime: slotStart,
          endtime: slotEnd,
          durationMinutes,
          score,
          quality: slotQuality(score),
          freeCount: participants.length,
          conflicts: [],
        });
      }

      if (slots.length >= 10) break;
      slotStart = addMinutes(slotStart, stepMinutes);
    }

    if (slots.length >= 10) break;
  }

  return {
    participants,
    searchStart,
    searchEnd,
    durationMinutes,
    slots,
    busyEvents: blockingEvents,
  };
};

const updateMeetingStatus = async (meetingId, updateData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = { ...updateData };
  if (data.starttime) data.starttime = new Date(data.starttime);
  if (data.endtime) data.endtime = new Date(data.endtime);

  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: data
  });
};

const updateMeeting = async (meetingId, updateData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = { ...updateData };
  const starttime = data.starttime ? new Date(data.starttime) : meeting.starttime;
  const endtime = data.endtime ? new Date(data.endtime) : meeting.endtime;

  if (endtime <= starttime) {
    throw new ApiError(400, 'End time must be after start time');
  }

  if (data.participants) {
    const workspace = await prisma.workspace.findUnique({
      where: { workspaceid: meeting.workspaceid },
      select: { member: true }
    });
    data.participants = normalizeParticipants(data.participants, workspace, meeting.organizer);
  }

  await calendarConflictService.assertNoCalendarConflicts({
    usernames: [...new Set([...(data.participants || meeting.participants), meeting.organizer])],
    starttime,
    endtime,
    excludeMeetingId: meetingId,
  });

  if (data.starttime) data.starttime = starttime;
  if (data.endtime) data.endtime = endtime;
  if (data.link === '') data.link = buildMeetingLink();

  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data,
    include: {
      workspace: {
        select: { name: true }
      },
      meetingMinute: true
    }
  });
};

const getMeetingMinutes = async (meetingId, currentUser) => {
  const meeting = await getMeetingById(meetingId, currentUser);
  if (!meeting) return null;

  const minutes = await prisma.meetingMinutes.findUnique({
    where: { meetingid: meetingId },
    include: { files: true },
  });

  return {
    meeting: { ...meeting, id: meeting.meetingid },
    minutes: serializeMeetingMinutes(minutes),
  };
};

const upsertMeetingMinutes = async (meetingId, minutesData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
  });

  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = {
    content: minutesData.content,
    raw_transcript: minutesData.raw_transcript,
    summary: minutesData.summary,
    decisions: minutesData.decisions || [],
    task: minutesData.task || [],
    isbotgenerated: minutesData.isbotgenerated ?? false,
    vectorembedding: [],
  };

  const minutes = await prisma.meetingMinutes.upsert({
    where: { meetingid: meetingId },
    update: data,
    create: {
      meetingid: meetingId,
      createby: currentUser.username,
      ...data,
    },
    include: { files: true },
  });

  return serializeMeetingMinutes(minutes);
};

const deleteMeeting = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: { meetingMinute: true }
  });

  if (!meeting) {
    throw new ApiError(404, 'Meeting not found');
  }

  await ensureCanManageMeeting(meeting, currentUser);

  if (meeting.meetingMinute) {
    await prisma.files.updateMany({
      where: { meetingminuteid: meeting.meetingMinute.meetingminuteid },
      data: { meetingminuteid: null }
    });

    await prisma.meetingMinutes.delete({
      where: { meetingminuteid: meeting.meetingMinute.meetingminuteid }
    });
  }

  await prisma.meeting.delete({
    where: { meetingid: meetingId }
  });
};

module.exports = {
  getAllMeetings,
  getMeetingsByWorkspace,
  getMeetingById,
  createMeeting,
  suggestMeetingSlots,
  updateMeetingStatus,
  updateMeeting,
  getMeetingMinutes,
  upsertMeetingMinutes,
  deleteMeeting
};
