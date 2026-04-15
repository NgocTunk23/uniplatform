const multer = require('multer');

// Configure multer to store files in memory for easy upload to Google Drive
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;
