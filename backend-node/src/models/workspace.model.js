const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  workspacerole: {
    type: String,
    enum: ['Leader', 'Member'],
    default: 'Member',
  },
  joinedat: {
    type: Date,
    default: Date.now,
  },
});

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  admin: {
    type: String,
    required: true, // Refers to User.username
  },
  members: [memberSchema],
}, {
  timestamps: true,
});

const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;
