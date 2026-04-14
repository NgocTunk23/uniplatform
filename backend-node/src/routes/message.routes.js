const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/:workspaceId', messageController.getChatHistory);

module.exports = router;
