/**
 * Centralized Socket.io Event names to avoid hardcoded strings across the app and tests.
 */
const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // Workspace events
  JOIN_WORKSPACE: 'join_workspace',
  WORKSPACE_JOINED: 'workspace_joined',
  
  // Chat events
  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message',
  RECEIVE_MESSAGE_CONFIRMED: 'receive_message_confirmed',
  
  // AI events
  ASK_AI: 'ask_ai',
  AI_STATUS: 'ai_status',
  
  // Meeting events
  JOIN_MEETING: 'join_meeting',
  LEAVE_MEETING: 'leave_meeting',
  MEETING_PARTICIPANTS_UPDATE: 'meeting_participants_update',
  WEBRTC_SIGNAL: 'webrtc_signal',
  
  ERROR: 'app_error'
};

module.exports = SOCKET_EVENTS;
