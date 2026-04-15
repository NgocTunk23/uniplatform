const prisma = require('../config/prisma');

const saveMessage = async (messageData) => {
  const { fileIds, workspaceId, ...otherData } = messageData;
  
  return await prisma.message.create({
    data: {
      content: otherData.content,
      senderusername: otherData.senderusername,
      workspaceId: workspaceId, // Set the scalar field directly
      replyToId: otherData.reply,
      mentions: otherData.mentions || [],
      vectorembedding: otherData.vectorembedding || [],
      // Connect uploaded files if any
      files: fileIds && fileIds.length > 0 ? {
        connect: fileIds.map(id => ({ id }))
      } : undefined
    },
    include: {
      files: true 
    }
  });
};

const getMessagesByWorkspace = async (workspaceId, limit = 50, skip = 0) => {
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
