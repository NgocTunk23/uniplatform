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
    fullname: userMap[m.username]?.fullname || m.username,
    imageggid: userMap[m.username]?.imageggid
  }));

  return workspace;
};

const createWorkspace = async (workspaceData) => {
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceData.name,
      admin: workspaceData.admin,
      member: {
        set: [{ username: workspaceData.admin, workspacerole: ROLES.WORKSPACE.LEADER }]
      }
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

  return await Promise.all(workspaces.map(w => enrichWorkspaceMembers(w)));
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
  return await prisma.workspace.delete({
    where: { workspaceid },
  });
};

const addMember = async (workspaceId, memberData, currentUser) => {
  // Only Leaders and System Admins can add members
  await permissionUtil.ensureLeader(workspaceId, currentUser);

  const workspace = await prisma.workspace.findUnique({ where: { workspaceid: workspaceId } });
  const member = workspace.member || [];
  
  // Check if already a member
  if (member.find(m => m.username === memberData.username)) {
    return await enrichWorkspaceMembers(workspace);
  }

  const result = await prisma.workspace.update({
    where: { workspaceid: workspaceId },
    data: {
      member: {
        push: [{
          username: memberData.username,
          workspacerole: memberData.workspacerole || ROLES.WORKSPACE.MEMBER,
          joinedat: new Date()
        }]
      }
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
      member: {
        set: updatedMembers
      }
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
      member: {
        set: updatedMembers
      }
    }
  });

  // Audit Log
  await logChange(currentUser.username, 'Workspace', workspaceId, workspace, result);

  return await enrichWorkspaceMembers(result);
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
};
