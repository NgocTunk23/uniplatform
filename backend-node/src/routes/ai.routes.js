const express = require('express');
const { generateResponse } = require('../services/ai.service');
const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: "Prompt is required" });

    // Gọi hàm generateResponse vừa viết
    const aiText = await generateResponse(prompt, context || []);
    res.json({ success: true, text: aiText });
  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
  }
});

module.exports = router;