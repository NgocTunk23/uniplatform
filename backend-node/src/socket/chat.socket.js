const aiService = require('../services/ai.service');
const ragService = require('../services/rag.service');
const messageService = require('../services/message.service');
const SOCKET_EVENTS = require('../constants/socket-events');
const permissionUtil = require('../utils/permission.util');

const registerChatHandlers = (io, socket) => {
  const user = socket.user;
  console.log(`⚡ User connected to chat: ${socket.id}`);

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (workspace_data) => {
    try {
      const workspaceid = typeof workspace_data === 'string' ? workspace_data : (workspace_data?.workspaceid || workspace_data?.workspaceId);
      if (!workspaceid) throw new Error('Missing workspaceid');
      // Security: Check if user is member of workspace
      await permissionUtil.getWorkspaceMembership(workspaceid, user);
      
      socket.join(workspaceid);
      console.log(`User ${socket.id} joined workspace: ${workspaceid}`);
      socket.emit(SOCKET_EVENTS.WORKSPACE_JOINED, { workspaceid });
    } catch (error) {
      console.error(`❌ Join Workspace Error: ${error.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
    try {
      const workspaceid = data.workspaceid || data.workspaceId;
      const { content, reply, mentions, fileIds } = data;
      
      // Security: Check if user can write
      await permissionUtil.ensureCanWrite(workspaceid, user);

      const senderusername = user.username;
      
      console.log(`📩 Received message from ${senderusername} in workspace ${workspaceid}: ${content}`);

      // 1. Broadcast immediately (snappy UI)
      io.to(workspaceid).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, { 
        ...data, 
        senderusername, 
        senderfullname: user.fullname,
        createdat: new Date() 
      });

      // 2. Background: Save to DB
      console.log('💾 Saving message to DB...');
      const newMessage = await messageService.saveMessage({
        workspaceid,
        senderusername,
        content,
        reply,
        mentions,
        fileIds
      });
      console.log('✅ Message saved with ID:', newMessage.messageid);

      // 3. Broadcast confirmed message
      io.to(workspaceid).emit(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, newMessage);

    } catch (error) {
      console.error('❌ Socket Error (send_message):', error.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // T5.4: Handle AI Chatbot interaction
  socket.on(SOCKET_EVENTS.ASK_AI, async (data) => {
    try {
      const workspaceid = data.workspaceid || data.workspaceId;
      const { prompt, senderusername } = data;
      
      // Security: Check if user can write
      await permissionUtil.ensureCanWrite(workspaceid, user);
      
      // Notify client that AI is typing
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'typing' });

      const aiResponse = await ragService.getAnswerFromKnowledge(workspaceid, prompt);

      // Save AI response to DB (optional, but good for history)
      const aiMessage = await messageService.saveMessage({
        workspaceid,
        senderusername: 'UniBot',
        content: aiResponse,
        reply: null
      });

      io.to(workspaceid).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, aiMessage);
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'done' });

    } catch (error) {
      console.error('❌ Socket Error (ask_ai):', error.message);
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'error', message: 'AI failed to respond' });
    }
  });
};

module.exports = { registerChatHandlers };
