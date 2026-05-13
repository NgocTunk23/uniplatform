const prisma = require('../config/prisma');
const ROLES = require('../constants/roles');
const permissionUtil = require('../utils/permission.util');
const { logChange } = require('../utils/audit-logger.util');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

const enrichWorkspaceMembers = async (workspace) => {
  if (!workspace || !workspace.member || workspace.member.length === 0) return workspace;

  const usernames = workspace.member.map(m => m.username);
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { username: true, fullname: true, imageggid: true }
  });

  const userMap = users.reduce((acc, user) => {
    acc[user.username] = user;
    return acc;
  }, {});

  workspace.member = workspace.member.map(m => ({
    ...m,
    fullname: m.fullname || userMap[m.username]?.fullname || m.username,
    imageggid: m.imageggid || userMap[m.username]?.imageggid
  }));

  return workspace;
};

const createWorkspace = async (workspaceData) => {
  // Fetch admin user data để lấy fullname và imageggid
  const adminUser = await prisma.user.findUnique({
    where: { username: workspaceData.admin },
    select: { username: true, fullname: true, imageggid: true }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceData.name,
      admin: workspaceData.admin,
      member: [{
        username: workspaceData.admin,
        fullname: adminUser?.fullname || workspaceData.admin,
        imageggid: adminUser?.imageggid || null,
        workspacerole: ROLES.WORKSPACE.LEADER
      }]
    }
  });
  return await enrichWorkspaceMembers(workspace);
};

const getAllWorkspaces = async (currentUser) => {
  let workspaces;
  // If not System Admin, only show workspaces user is a member of
  if (currentUser.role === ROLES.SYSTEM.ADMIN) {
    workspaces = await prisma.workspace.findMany({
      include: {
        _count: { select: { messages: true } }
      }
    });
  } else {
    workspaces = await prisma.workspace.findMany({
      where: {
        member: {
          some: { username: currentUser.username }
        }
      },
      include: {
        _count: { select: { messages: true } }
      }
    });
  }

  // Calculate unread count for each workspace
  const workspacesWithUnread = await Promise.all(workspaces.map(async (w) => {
    const enriched = await enrichWorkspaceMembers(w);
    const memberInfo = w.member.find(m => m.username === currentUser.username);
    
    // If user is not a member (can happen for System Admin), unread is 0
    if (!memberInfo) {
      return { ...enriched, unreadCount: 0 };
    }

    const lastReadAt = memberInfo.lastReadAt || new Date(0);

    const unreadCount = await prisma.messages.count({
      where: {
        workspaceid: w.workspaceid,
        createdat: { gt: lastReadAt },
        senderusername: { not: currentUser.username }
      }
    });

    return { ...enriched, unreadCount };
  }));

  return workspacesWithUnread;
};

const getWorkspaceById = async (workspaceid, currentUser) => {
  // Membership check
  await permissionUtil.getWorkspaceMembership(workspaceid, currentUser);

  const workspace = await prisma.workspace.findUnique({
    where: { workspaceid }
  });

  return await enrichWorkspaceMembers(workspace);
};

const updateWorkspace = async (workspaceid, updateData, currentUser) => {
  await permissionUtil.ensureLeader(workspaceid, currentUser);
  const result = await prisma.workspace.update({
    where: { workspaceid },
    data: updateData,
  });
  return await enrichWorkspaceMembers(result);
};

const deleteWorkspace = async (workspaceid, currentUser) => {
  await permissionUtil.ensureLeader(workspaceid, currentUser);

  // 1. Xóa tất cả tin nhắn thuộc về workspace này
  await prisma.messages.deleteMany({
    where: { workspaceid: workspaceid }
  });

  // 2. Xóa tất cả các cuộc họp thuộc về workspace này
  await prisma.meeting.deleteMany({
    where: { workspaceid: workspaceid }
  });

  // 3. Cuối cùng mới tiến hành xóa workspace
  return await prisma.workspace.delete({
    where: { workspaceid },
  });
};

const addMember = async (workspaceId, memberData, currentUser) => {
  // Only Leaders and System Admins can add members
  await permissionUtil.ensureLeader(workspaceId, currentUser);

  // Validate that the user exists - support both username and email
  let userToAdd = await prisma.user.findUnique({
    where: { username: memberData.username },
    select: { username: true, fullname: true, imageggid: true }
  });
  
  // If not found by username, try by email
  if (!userToAdd) {
    userToAdd = await prisma.user.findUnique({
      where: { email: memberData.username },
      select: { username: true, fullname: true, imageggid: true }
    });
  }
  
  if (!userToAdd) {
    throw new ApiError(404, `User '${memberData.username}' not found. Please check the username or email.`, ERROR_CODES.VALIDATION.VALIDATION_ERROR);
  }
  
  // Use the actual username from the found user
  const actualUsername = userToAdd.username;

  const workspace = await prisma.workspace.findUnique({ where: { workspaceid: workspaceId } });
  const member = workspace.member || [];
  
  // Check if already a member
  if (member.find(m => m.username === actualUsername)) {
    return await enrichWorkspaceMembers(workspace);
  }

  const result = await prisma.workspace.update({
    where: { workspaceid: workspaceId },
    data: {
      member: [...member, {
        username: actualUsername,
        fullname: userToAdd.fullname || actualUsername,
        imageggid: userToAdd.imageggid || null,
        workspacerole: memberData.workspacerole || ROLES.WORKSPACE.MEMBER,
        joinedat: new Date()
      }]
    }
  });

  // Audit Log
  await logChange(currentUser.username, 'Workspace', workspaceId, workspace, result);
  
  return await enrichWorkspaceMembers(result);
};

const removeMember = async (workspaceId, username, currentUser) => {
  await permissionUtil.ensureLeader(workspaceId, currentUser);

  const workspace = await prisma.workspace.findUnique({ where: { workspaceid: workspaceId } });
  const member = workspace.member || [];
  const updatedMembers = member.filter(m => m.username !== username);

  const result = await prisma.workspace.update({
    where: { workspaceid: workspaceId },
    data: {
      member: updatedMembers
    }
  });

  // Audit Log
  await logChange(currentUser.username, 'Workspace', workspaceId, workspace, result);

  return await enrichWorkspaceMembers(result);
};

const updateMemberRole = async (workspaceId, username, workspacerole, currentUser) => {
  await permissionUtil.ensureLeader(workspaceId, currentUser);

  const workspace = await prisma.workspace.findUnique({ where: { workspaceid: workspaceId } });
  const member = workspace.member || [];
  const updatedMembers = member.map(m => 
    m.username === username ? { ...m, workspacerole } : m
  );

  const result = await prisma.workspace.update({
    where: { workspaceid: workspaceId },
    data: {
      member: updatedMembers
    }
  });

  // Audit Log
  await logChange(currentUser.username, 'Workspace', workspaceId, workspace, result);

  return await enrichWorkspaceMembers(result);
};

const markAsRead = async (workspaceid, username) => {
  const workspace = await prisma.workspace.findUnique({ where: { workspaceid } });
  if (!workspace) return null;

  const updatedMembers = workspace.member.map(m => 
    m.username === username ? { ...m, lastReadAt: new Date() } : m
  );

  return await prisma.workspace.update({
    where: { workspaceid },
    data: {
      member: updatedMembers
    }
  });
};

module.exports = {
  createWorkspace,
  getAllWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  removeMember,
  updateMemberRole,
  markAsRead,
};
