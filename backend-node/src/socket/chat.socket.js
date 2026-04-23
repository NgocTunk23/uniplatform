const aiService = require('../services/ai.service');
const ragService = require('../services/rag.service');
const messageService = require('../services/message.service');
const SOCKET_EVENTS = require('../constants/socket-events');
const permissionUtil = require('../utils/permission.util');

const registerChatHandlers = (io, socket) => {
  const user = socket.user;
  console.log(`⚡ User connected to chat: ${socket.id}`);

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (workspaceId) => {
    try {
      // Security: Check if user is member of workspace
      await permissionUtil.getWorkspaceMembership(workspaceId, user);
      
      socket.join(workspaceId);
      console.log(`User ${socket.id} joined workspace: ${workspaceId}`);
      socket.emit(SOCKET_EVENTS.WORKSPACE_JOINED, { workspaceId });
    } catch (error) {
      console.error(`❌ Join Workspace Error: ${error.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
    try {
      const { workspaceId, content, reply, mentions, fileIds } = data;
      
      // Security: Check if user can write
      await permissionUtil.ensureCanWrite(workspaceId, user);

      const senderusername = user.username;
      
      console.log(`📩 Received message from ${senderusername} in workspace ${workspaceId}: ${content}`);

      // 1. Broadcast immediately (snappy UI)
      io.to(workspaceId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, { 
        ...data, 
        senderusername, 
        createdAt: new Date() 
      });

      // 2. Background: Generate Embedding and Save to DB
      console.log('🧠 Generating embedding...');
      const embedding = await aiService.getEmbedding(content);
      
      console.log('💾 Saving message to DB...');
      const newMessage = await messageService.saveMessage({
        workspaceId,
        senderusername,
        content,
        reply,
        mentions,
        fileIds,
        vectorembedding: embedding
      });
      console.log('✅ Message saved with ID:', newMessage.id);

      // 3. Broadcast the confirmed message with actual DB IDs and File metadata
      io.to(workspaceId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, newMessage);

    } catch (error) {
      console.error('❌ Socket Error (send_message):', error.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // T5.4: Handle AI Chatbot interaction
  socket.on(SOCKET_EVENTS.ASK_AI, async (data) => {
    try {
      const { workspaceId, prompt, senderusername } = data;
      
      // Security: Check if user can write
      await permissionUtil.ensureCanWrite(workspaceId, user);
      
      // Notify client that AI is typing
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'typing' });

      const aiResponse = await ragService.getAnswerFromKnowledge(workspaceId, prompt);

      // Save AI response to DB (optional, but good for history)
      const aiMessage = await messageService.saveMessage({
        workspaceId,
        senderusername: 'UniBot',
        content: aiResponse,
        reply: null
      });

      io.to(workspaceId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, aiMessage);
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'done' });

    } catch (error) {
      console.error('❌ Socket Error (ask_ai):', error.message);
      socket.emit(SOCKET_EVENTS.AI_STATUS, { status: 'error', message: 'AI failed to respond' });
    }
  });
};

module.exports = { registerChatHandlers };
