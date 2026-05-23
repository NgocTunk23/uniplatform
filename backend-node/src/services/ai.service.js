const dotenv = require('dotenv');
dotenv.config();

// const getOllamaBaseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const getOllamaBaseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434').replace(/\/$/, '');
const getOllamaModel = () => process.env.OLLAMA_MODEL || 'qwen3:1.7b';

/**
 * Service to interact with local Ollama API for Chat Assistant
 */
const generateResponse = async (prompt, context = []) => {
  try {
    // 1. Chuyển đổi ngữ cảnh cũ (lịch sử chat) thành format của Ollama
    const messages = context.map(c => ({
      role: c.senderusername === 'user' ? 'user' : 'assistant',
      content: c.content
    }));

    // 2. Thêm System Prompt để định hình tính cách cho AI
    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: 'Bạn là trợ lý AI ảo của hệ thống UniPlatform. Tên của bạn là UniPlatform AI. Hãy trả lời thật ngắn gọn, súc tích, thân thiện và hoàn toàn bằng tiếng Việt.'
      });
    }

    // 3. Thêm câu hỏi hiện tại của người dùng
    messages.push({
      role: 'user',
      content: prompt
    });

    // 4. Gọi tới Ollama API đang chạy ở localhost
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getOllamaModel(),
        stream: false, // Trả về 1 lần để UI hiển thị dễ dàng
        options: { temperature: 0.6 },
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Ollama API lỗi HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.message.content;

  } catch (error) {
    console.error('❌ Ollama Chat Error:', error.message);
    throw error;
  }
};

/**
 * Generate vector embedding using local Ollama (thay cho Gemini Embedding)
 */
const getEmbedding = async (text) => {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getOllamaModel(),
        prompt: text
      })
    });
    const data = await response.json();
    return data.embedding || [];
  } catch (error) {
    console.error('❌ Ollama Embedding Error:', error.message);
    return [];
  }
};

module.exports = {
  generateResponse,
  getEmbedding,
};