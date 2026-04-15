const prisma = require('../config/prisma');
const ROLES = require('../constants/roles');

const createWorkspace = async (workspaceData) => {
  return await prisma.workspace.create({
    data: {
      name: workspaceData.name,
      admin: workspaceData.admin,
      members: {
        set: [{ username: workspaceData.admin, workspacerole: ROLES.WORKSPACE.LEADER }]
      }
    }
  });
};

const getAllWorkspaces = async () => {
  return await prisma.workspace.findMany({
    include: {
      members: true,
      _count: {
        select: { messages: true }
      }
    }
  });
};

const getWorkspaceById = async (id) => {
  return await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: true,
    }
  });
};

const updateWorkspace = async (id, updateData) => {
  return await prisma.workspace.update({
    where: { id },
    data: updateData,
  });
};

const deleteWorkspace = async (id) => {
  return await prisma.workspace.delete({
    where: { id },
  });
};

const addMember = async (workspaceId, memberData) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const members = workspace.members || [];
  
  // Check if already a member
  if (members.find(m => m.username === memberData.username)) {
    return workspace;
  }

  return await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      members: {
        push: [{
          username: memberData.username,
          workspacerole: memberData.workspacerole || ROLES.WORKSPACE.MEMBER,
          joinedat: new Date()
        }]
      }
    }
  });
};

const removeMember = async (workspaceId, username) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const members = workspace.members || [];
  const updatedMembers = members.filter(m => m.username !== username);

  return await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      members: {
        set: updatedMembers
      }
    }
  });
};

const updateMemberRole = async (workspaceId, username, workspacerole) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const members = workspace.members || [];
  const updatedMembers = members.map(m => 
    m.username === username ? { ...m, workspacerole } : m
  );

  return await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      members: {
        set: updatedMembers
      }
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
};
