const prisma = require('../config/prisma');

const saveMessage = async (messageData) => {
  return await prisma.message.create({
    data: {
      workspaceId: messageData.workspaceid,
      senderusername: messageData.senderusername,
      content: messageData.content,
      replyToId: messageData.reply,
      mentions: messageData.mentions || [],
      vectorembedding: messageData.vectorembedding || [],
    }
  });
};

const getMessagesByWorkspace = async (workspaceId, limit = 50, skip = 0) => {
  return await prisma.message.findMany({
    where: { workspaceId: workspaceId },
    take: limit,
    skip: skip,
    orderBy: { createdAt: 'desc' },
  });
};

module.exports = {
  saveMessage,
  getMessagesByWorkspace,
};
