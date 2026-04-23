const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  workspaceid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  senderusername: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  reply: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  mentions: [String], // Array of usernames
  vectorembedding: {
    type: [Number],
    default: [],
  },
}, {
  timestamps: true,
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
