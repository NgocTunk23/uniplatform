const multer = require('multer');

// Configure multer to store files in memory for easy upload to Google Drive
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

module.exports = upload;
