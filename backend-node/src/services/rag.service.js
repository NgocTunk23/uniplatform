const aiService = require('./ai.service');
const prisma = require('../config/prisma');

/**
 * Retrieval-Augmented Generation (RAG) Service
 */
const getAnswerFromKnowledge = async (workspaceId, userQuery) => {
  try {
    // 1. Convert user query to vector
    const queryVector = await aiService.getEmbedding(userQuery);

    // 2. Search for relevant context in Messages
    // Note: On MongoDB Atlas, you would use $vectorSearch.
    // On local DB, we retrieve recent context as fallback.
    const relevantMessages = await prisma.message.findMany({
      where: { workspaceId: workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 3. Optional: Similarity filtering in memory (if queryVector is available)
    // ...

    // 4. Send query + context to Gemini
    const aiResponse = await aiService.generateResponse(userQuery, relevantMessages);

    return aiResponse;
  } catch (error) {
    console.error('❌ RAG Service Error:', error.message);
    return "Xin lỗi, tôi gặp lỗi khi truy cập dữ liệu để trả lời bạn.";
  }
};

module.exports = {
  getAnswerFromKnowledge,
};
