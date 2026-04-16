const prisma = require('../config/prisma');
const permissionUtil = require('../utils/permission.util');

const saveMessage = async (messageData) => {
  const { fileIds, workspaceId, ...otherData } = messageData;
  
  return await prisma.message.create({
    data: {
      content: otherData.content,
      senderusername: otherData.senderusername,
      workspaceId: workspaceId,
      replyToId: otherData.reply,
      mentions: otherData.mentions || [],
      vectorembedding: otherData.vectorembedding || [],
      files: fileIds && fileIds.length > 0 ? {
        connect: fileIds.map(id => ({ id }))
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

  return await prisma.message.findMany({
    where: { workspaceId: workspaceId },
    take: limit,
    skip: skip,
    orderBy: { createdAt: 'desc' },
    include: {
      files: true
    }
  });
};

module.exports = {
  saveMessage,
  getMessagesByWorkspace,
};
