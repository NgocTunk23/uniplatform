const aiService = require('./ai.service');
const prisma = require('../config/prisma');

/**
 * Trích xuất Lịch trình của người dùng hiện tại (Bảo mật 100%)
 */
const fetchUserSchedules = async (username) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = await prisma.schedules.findMany({
    where: { 
      username: username, // KHOÁ BẢO MẬT: Chỉ lấy lịch của đúng username này
      starttime: { gte: today } 
    },
    orderBy: { starttime: 'asc' },
    take: 5 // Lấy 5 sự kiện sắp tới
  });

  if (schedules.length === 0) return "Không có lịch trình nào sắp tới.";
  
  return schedules.map(s => 
    `- [${s.type}] ${s.title}: Từ ${s.starttime.toLocaleString('vi-VN')} đến ${s.endtime.toLocaleString('vi-VN')} (${s.description || 'Không có mô tả'})`
  ).join('\n');
};

/**
 * Trích xuất Biên bản cuộc họp của người dùng hiện tại
 */
const fetchUserMeetings = async (username) => {
  const minutes = await prisma.meetingMinutes.findMany({
    where: { 
      createby: username 
    },
    // SỬA Ở ĐÂY: Dùng 'createdat' thay vì '_id'
    orderBy: { createdat: 'desc' }, 
    take: 3
  });

  if (minutes.length === 0) return "Không tìm thấy biên bản cuộc họp nào gần đây.";

  return minutes.map(m => 
    `Biên bản:\n+ Tóm tắt: ${m.summary || 'Trống'}\n+ Quyết định: ${(m.decisions && m.decisions.length > 0) ? m.decisions.join(', ') : 'Không có'}`
  ).join('\n\n');
};

/**
 * Main Logic: Phân tích intent và gắn Context an toàn trước khi gọi Ollama
 */
const processChatWithPrivacy = async (user, prompt, chatHistory) => {
  try {
    const username = user.username;
    // SỬA LẠI BASE PROMPT: Nới lỏng việc "không bịa đặt" thành "không bịa đặt dữ liệu CÁ NHÂN"
    let systemInstruction = "Bạn là trợ lý AI ảo của hệ thống UniPlatform tên là UniPlatform AI. Hãy trả lời ngắn gọn, thân thiện bằng tiếng Việt. Tuyệt đối không bịa đặt dữ liệu cá nhân của người dùng nếu không biết.";

    const promptLower = prompt.toLowerCase();

    // 1. Nhận diện ý định (Intent Recognition)
    const askForSchedule = promptLower.includes('lịch') || promptLower.includes('schedule') || promptLower.includes('ngày mai');
    const askForMeeting = promptLower.includes('họp') || promptLower.includes('biên bản') || promptLower.includes('meeting');

    // 2. Thu thập dữ liệu bảo mật
    let injectedContext = "";
    if (askForSchedule) {
      const scheduleData = await fetchUserSchedules(username);
      injectedContext += `\n--- LỊCH TRÌNH CỦA [${username}] ---\n${scheduleData}\n`;
    }

    if (askForMeeting) {
      const meetingData = await fetchUserMeetings(username);
      injectedContext += `\n--- CUỘC HỌP CỦA [${username}] ---\n${meetingData}\n`;
    }

    // 3. SỬA LẠI SYSTEM PROMPT ĐỘNG: Hướng dẫn AI cách xử lý tình huống thông minh hơn
    if (injectedContext !== "") {
      systemInstruction += `

Hệ thống cung cấp dữ liệu riêng tư sau:
${injectedContext}

HƯỚNG DẪN TRẢ LỜI (QUAN TRỌNG):
1. Nếu câu hỏi liên quan đến lịch trình/biên bản cụ thể của người dùng: Dùng dữ liệu trên để trả lời.
2. NẾU câu hỏi là TƯ VẤN KIẾN THỨC CHUNG (ví dụ: "Giờ nào họp tốt nhất?", "Cách làm việc hiệu quả?"): BỎ QUA dữ liệu bị trống bên trên. Hãy tự do dùng kiến thức chung của bạn để tư vấn một cách tự nhiên, hữu ích nhất.`;
    }

    // 4. Gọi tầng AI Service
    const aiResponse = await aiService.generateResponse(prompt, chatHistory, systemInstruction);
    return aiResponse;

  } catch (error) {
    console.error('❌ RAG Service Error:', error.message);
    return "Xin lỗi, tôi gặp lỗi khi truy xuất dữ liệu an toàn của bạn.";
  }
};

module.exports = {
  processChatWithPrivacy,
};