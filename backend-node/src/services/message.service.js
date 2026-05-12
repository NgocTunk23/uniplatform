const prisma = require('../config/prisma');
const permissionUtil = require('../utils/permission.util');

const saveMessage = async (messageData) => {
  const { fileIds, workspaceid, ...otherData } = messageData;
  
  const newMessage = await prisma.messages.create({
    data: {
      content: otherData.content,
      senderusername: otherData.senderusername,
      workspace: { connect: { workspaceid: workspaceid } },
      reply: otherData.reply,
      userid: otherData.mentions || [],
      vectorembedding: [], // Embedding disabled
      files: fileIds && fileIds.length > 0 ? {
        connect: fileIds.map(id => ({ fileid: id }))
      } : undefined
    },
    include: {
      files: true 
    }
  });

  const sender = await prisma.user.findUnique({
    where: { username: newMessage.senderusername },
    select: { fullname: true, imageggid: true } // Sửa dòng này: thêm imageggid: true
  });

  return {
    ...newMessage,
    id: newMessage.messageid,
    senderfullname: sender?.fullname || newMessage.senderusername,
    senderimageggid: sender?.imageggid || null // Thêm dòng này để trả ảnh qua Socket
  };
};

const getMessagesByWorkspace = async (workspaceid, currentUser, limit = 50, skip = 0) => {
  // Security check: must be member
  await permissionUtil.getWorkspaceMembership(workspaceid, currentUser);

  const messages = await prisma.messages.findMany({
    where: { workspaceid: workspaceid },
    take: limit,
    skip: skip,
    orderBy: { createdat: 'desc' },
    include: {
      files: true
    }
  });

  const senders = [...new Set(messages.map(m => m.senderusername))];
  // Sửa đoạn này: Thêm imageggid: true vào select
  const users = await prisma.user.findMany({
    where: { username: { in: senders } },
    select: { username: true, fullname: true, imageggid: true } 
  });
  
  const userMap = {};
  users.forEach(u => userMap[u.username] = { 
    fullname: u.fullname, 
    imageggid: u.imageggid 
  });

  return messages.map(m => ({
    ...m,
    id: m.messageid,
    senderfullname: userMap[m.senderusername]?.fullname || m.senderusername,
    senderimageggid: userMap[m.senderusername]?.imageggid || null // Trả thêm trường này về frontend
  }));
};

module.exports = {
  saveMessage,
  getMessagesByWorkspace,
};
