const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const uploadMiddleware = require('../middlewares/upload.middleware');

router.post('/upload', uploadMiddleware.single('file'), fileController.uploadFile);
router.delete('/:id', fileController.deleteFile);

module.exports = router;
