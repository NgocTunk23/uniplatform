const aiService = require('../services/ai.service');
const ragService = require('../services/rag.service');
const messageService = require('../services/message.service');

const registerChatHandlers = (io, socket) => {
  console.log(`⚡ User connected to chat: ${socket.id}`);

  socket.on('join_workspace', (workspaceId) => {
    socket.join(workspaceId);
    console.log(`User ${socket.id} joined workspace: ${workspaceId}`);
    socket.emit('workspace_joined', { workspaceId });
  });

  socket.on('send_message', async (data) => {
    try {
      const { workspaceId, content, reply, mentions, fileIds } = data;
      const senderusername = socket.user.username;
      
      console.log(`📩 Received message from ${senderusername} in workspace ${workspaceId}: ${content}`);

      // 1. Broadcast immediately (snappy UI)
      io.to(workspaceId).emit('receive_message', { 
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
      io.to(workspaceId).emit('receive_message_confirmed', newMessage);

    } catch (error) {
      console.error('❌ Socket Error (send_message):', error.message);
      console.error(error.stack);
    }
  });

  // T5.4: Handle AI Chatbot interaction
  socket.on('ask_ai', async (data) => {
    try {
      const { workspaceId, prompt, senderusername } = data;
      
      // Notify client that AI is typing
      socket.emit('ai_status', { status: 'typing' });

      const aiResponse = await ragService.getAnswerFromKnowledge(workspaceId, prompt);

      // Save AI response to DB (optional, but good for history)
      const aiMessage = await messageService.saveMessage({
        workspaceId,
        senderusername: 'UniBot',
        content: aiResponse,
        reply: null
      });

      io.to(workspaceId).emit('receive_message', aiMessage);
      socket.emit('ai_status', { status: 'done' });

    } catch (error) {
      console.error('❌ Socket Error (ask_ai):', error.message);
      socket.emit('ai_status', { status: 'error', message: 'AI failed to respond' });
    }
  });
};

module.exports = registerChatHandlers;
