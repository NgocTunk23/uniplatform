const dotenv = require('dotenv');
dotenv.config();

// Sử dụng cơ chế Agent của thư viện mạng undici (thư viện gốc quản lý fetch của Node.js)
const { Agent } = require('undici');

const keepAliveDispatcher = new Agent({
  keepAliveTimeout: 10000, // Duy trì socket sống trong 10 giây để chat tiếp
  keepAliveMaxTimeout: 60000,
  connections: 10         // Giới hạn luồng tối đa tránh kẹt port 65535
});

const getOllamaBaseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434').replace(/\/$/, '');
const getOllamaModel = () => process.env.OLLAMA_MODEL || 'qwen3:1.7b';

const generateResponse = async (prompt, context = []) => {
  try {
    const messages = context.map(c => ({
      role: c.senderusername === 'user' ? 'user' : 'assistant',
      content: c.content
    }));

    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: 'Bạn là trợ lý AI ảo của hệ thống UniPlatform. Tên của bạn là UniPlatform AI. Hãy trả lời thật ngắn gọn, súc tích, thân thiện và hoàn toàn bằng tiếng Việt.'
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    // Thực hiện cuộc gọi fetch an toàn không rò rỉ socket
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      dispatcher: keepAliveDispatcher, // Ép Node.js tái sử dụng socket cũ tại đây
      body: JSON.stringify({
        model: getOllamaModel(),
        stream: false,
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