const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_placeholder') {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Service to interact with Gemini API
 */
const generateResponse = async (prompt, context = []) => {
  const genAI = getGenAI();
  try {
    if (!genAI) {
      console.log('🤖 Mock AI response (API Key missing):', prompt);
      return `[MOCK] Phản hồi từ AI cho: "${prompt}". (Vui lòng thêm GEMINI_API_KEY vào .env để sử dụng AI thật).`;
    }

    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

    // Format context for better response
    const formattedContext = context.map(c => `${c.senderusername}: ${c.content}`).join('\n');
    const fullPrompt = `Ngữ cảnh các tin nhắn trước:\n${formattedContext}\n\nCâu hỏi: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini Response Error:', error.message);
    throw error;
  }
};

/**
 * Generate vector embedding for text using Gemini's embedding model
 */
const getEmbedding = async (text) => {
  const genAI = getGenAI();
  try {
    if (!genAI) {
      // Return a mock 768-dimensional vector (typical for Gemini)
      return Array.from({ length: 768 }, () => Math.random());
    }

    const model = genAI.getGenerativeModel({ model: "models/text-embedding-004" });
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
