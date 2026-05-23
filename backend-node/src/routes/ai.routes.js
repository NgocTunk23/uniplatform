const express = require('express');
const { processChatWithPrivacy } = require('../services/rag.service');
// Đổi từ verifyToken thành protect theo đúng file middleware của bạn
const { protect } = require('../middlewares/auth.middleware'); 
const router = express.Router();

// Sử dụng protect middleware để bắt buộc có JWT Token
router.post('/chat', protect, async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const user = req.user; // Biến này do middleware protect tạo ra

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }
    
    // Đảm bảo user có dữ liệu username
    if (!user || !user.username) {
       return res.status(401).json({ success: false, message: "Unauthorized: Không xác định được danh tính" });
    }

    // Giao cho RAG Service làm người gác cổng
    const aiText = await processChatWithPrivacy(user, prompt, context || []);
    res.json({ success: true, text: aiText });
  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
  }
});

module.exports = router;