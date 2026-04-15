const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY && API_KEY !== 'your_gemini_api_key_placeholder' ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Service to interact with Gemini API
 */
const generateResponse = async (prompt, context = []) => {
  try {
    if (!genAI) {
      console.log('🤖 Mock AI response (API Key missing):', prompt);
      return `[MOCK] Phản hồi từ AI cho: "${prompt}". (Vui lòng thêm GEMINI_API_KEY vào .env để sử dụng AI thật).`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Format context for better response
    const formattedContext = context.map(c => `${c.senderusername}: ${c.content}`).join('\n');
    const fullPrompt = `Ngữ cảnh các tin nhắn trước:\n${formattedContext}\n\nCâu hỏi: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('❌ Gemini Response Error:', error.message);
    throw error;
  }
};

/**
 * Generate vector embedding for text using Gemini's embedding model
 */
const getEmbedding = async (text) => {
  try {
    if (!genAI) {
      // Return a mock 768-dimensional vector (typical for Gemini)
      return Array.from({ length: 768 }, () => Math.random());
    }

    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('❌ Gemini Embedding Error:', error.message);
    // Don't throw embedding errors to avoid breaking the chat flow
    return [];
  }
};

module.exports = {
  generateResponse,
  getEmbedding,
};
