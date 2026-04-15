const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  actorusername: {
    type: String,
    required: true,
  },
  targetresource: {
    type: String,
    required: true,
  },
  targetid: {
    type: String,
  },
  changes: [{
    field: String,
    new: mongoose.Schema.Types.Mixed,
    old: mongoose.Schema.Types.Mixed,
  }],
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

const SystemLog = mongoose.model('SystemLog', systemLogSchema);

module.exports = SystemLog;
