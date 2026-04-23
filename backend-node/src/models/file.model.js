const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  uploader: {
    type: String, // Refers to User.username
    required: true,
  },
  messageid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  meetingminuteid: {
    type: String, // Refers to MeetingMinutes model (from other module)
  },
  filename: {
    type: String,
    required: true,
  },
  ggid: {
    type: String,
    required: true, // Google Drive File ID
  },
  typefile: String,
  sizefile: String,
}, {
  timestamps: true,
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
