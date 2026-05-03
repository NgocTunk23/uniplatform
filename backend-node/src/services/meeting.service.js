const prisma = require('../config/prisma');
const ROLES = require('../constants/roles');
const permissionUtil = require('../utils/permission.util');

const getAllMeetings = async (currentUser) => {
  // Get all workspaces the user is a member of
  const workspaces = await prisma.workspace.findMany({
    where: {
      member: {
        some: { username: currentUser.username }
      }
    },
    select: { workspaceid: true }
  });

  const workspaceIds = workspaces.map(w => w.workspaceid);

  // If user is admin, they might want all meetings, but usually they want meetings of their workspaces
  // Unless we want a global admin view. For now, let's stick to user's workspaces.
  
  const query = currentUser.role === ROLES.SYSTEM.ADMIN ? {} : { workspaceid: { in: workspaceIds } };

  return await prisma.meeting.findMany({
    where: query,
    include: {
      workspace: {
        select: { name: true }
      },
      meetingMinute: true
    },
    orderBy: { starttime: 'desc' }
  });
};

const getMeetingsByWorkspace = async (workspaceId, currentUser) => {
  await permissionUtil.getWorkspaceMembership(workspaceId, currentUser);

  return await prisma.meeting.findMany({
    where: { workspaceid: workspaceId },
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
  await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);

  return meeting;
};

const createMeeting = async (meetingData, currentUser) => {
  await permissionUtil.ensureLeader(meetingData.workspaceid, currentUser);

  return await prisma.meeting.create({
    data: {
      workspaceid: meetingData.workspaceid,
      title: meetingData.title,
      starttime: new Date(meetingData.starttime),
      endtime: new Date(meetingData.endtime),
      organizer: currentUser.username,
      participants: meetingData.participants || [currentUser.username],
      status: 'upcoming',
      link: meetingData.link || `https://meet.uniplatform.com/${Math.random().toString(36).substring(2, 10)}`,
      place: meetingData.place,
      bot_status: 'idle'
    }
  });
};

const updateMeetingStatus = async (meetingId, updateData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) return null;

  // Only organizer or Leader can update status
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const isOrganizer = meeting.organizer === currentUser.username;

  if (!isLeader && !isOrganizer) {
    throw new ApiError(403, 'Authority denied. Only Leaders or the Organizer can perform this action.');
  }

  const data = { ...updateData };
  if (data.starttime) data.starttime = new Date(data.starttime);
  if (data.endtime) data.endtime = new Date(data.endtime);

  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: data
  });
};

module.exports = {
  getAllMeetings,
  getMeetingsByWorkspace,
  getMeetingById,
  createMeeting,
  updateMeetingStatus
};
