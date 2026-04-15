const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const auth = require('../middlewares/auth.middleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

router.post('/upload', auth.protect, uploadMiddleware.single('file'), fileController.uploadFile);
router.delete('/:id', auth.protect, fileController.deleteFile);

module.exports = router;
