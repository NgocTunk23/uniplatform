const dotenv = require('dotenv');
dotenv.config();

const { Agent } = require('undici');

const keepAliveDispatcher = new Agent({
  keepAliveTimeout: 60000, 
  keepAliveMaxTimeout: 60000,
  connections: 10,
  headersTimeout: 300000,
  bodyTimeout: 300000
});

const getOllamaBaseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434').replace(/\/$/, '');
const getOllamaModel = () => process.env.OLLAMA_MODEL || 'qwen3:1.7b';

// THÊM THAM SỐ systemInstruction
const generateResponse = async (prompt, context = [], systemInstruction = null) => {
  try {
    const messages = context.map(c => ({
      role: c.senderusername === 'user' ? 'user' : 'assistant',
      content: c.content
    }));

    // Gắn System Prompt động được tiêm dữ liệu từ RAG
    const defaultSystem = 'Bạn là trợ lý AI ảo của hệ thống UniPlatform. Hãy trả lời thật ngắn gọn, thân thiện bằng tiếng Việt.';
    messages.unshift({
      role: 'system',
      content: systemInstruction || defaultSystem
    });

    messages.push({
      role: 'user',
      content: prompt
    });

    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      dispatcher: keepAliveDispatcher,
      body: JSON.stringify({
        model: getOllamaModel(),
        stream: false,
        options: { temperature: 0.3 }, // Giảm temperature xuống 0.3 để AI trả lời chính xác dựa trên DB, bớt sáng tạo linh tinh
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