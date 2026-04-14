const aiService = require('../services/ai.service');
const ragService = require('../services/rag.service');

const registerChatHandlers = (io, socket) => {
  console.log(`⚡ User connected to chat: ${socket.id}`);

  socket.on('join_workspace', (workspaceId) => {
    socket.join(workspaceId);
    console.log(`User ${socket.id} joined workspace: ${workspaceId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { workspaceId, senderusername, content, reply, mentions } = data;
      
      // 1. Broadcast immediately for responsiveness
      io.to(workspaceId).emit('receive_message', { ...data, createdAt: new Date() });

      // 2. Background: Generate Embedding and Save to DB
      const embedding = await aiService.getEmbedding(content);
      
      const newMessage = await messageService.saveMessage({
        workspaceid: workspaceId,
        senderusername,
        content,
        reply,
        mentions,
        vectorembedding: embedding
      });

    } catch (error) {
      console.error('❌ Socket Error (send_message):', error.message);
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
        workspaceid: workspaceId,
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
