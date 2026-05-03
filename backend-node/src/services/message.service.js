const prisma = require('../config/prisma');
const permissionUtil = require('../utils/permission.util');

const saveMessage = async (messageData) => {
  const { fileIds, workspaceId, ...otherData } = messageData;
  
  return await prisma.messages.create({
    data: {
      content: otherData.content,
      senderusername: otherData.senderusername,
      workspaceid: workspaceId,
      reply: otherData.reply,
      userid: otherData.mentions || [],
      vectorembedding: otherData.vectorembedding || [],
      files: fileIds && fileIds.length > 0 ? {
        connect: fileIds.map(id => ({ fileid: id }))
      } : undefined
    },
    include: {
      files: true 
    }
  });
};

const getMessagesByWorkspace = async (workspaceId, currentUser, limit = 50, skip = 0) => {
  // Security check: must be member
  await permissionUtil.getWorkspaceMembership(workspaceId, currentUser);

  const messages = await prisma.messages.findMany({
    where: { workspaceid: workspaceId },
    take: limit,
    skip: skip,
    orderBy: { createat: 'desc' },
    include: {
      files: true
    }
  });

  const senders = [...new Set(messages.map(m => m.senderusername))];
  const users = await prisma.user.findMany({
    where: { username: { in: senders } },
    select: { username: true, fullname: true }
  });
  
  const userMap = {};
  users.forEach(u => userMap[u.username] = u.fullname);

  return messages.map(m => ({
    ...m,
    id: m.messageid,
    senderfullname: userMap[m.senderusername] || m.senderusername
  }));
};

module.exports = {
  saveMessage,
  getMessagesByWorkspace,
};
