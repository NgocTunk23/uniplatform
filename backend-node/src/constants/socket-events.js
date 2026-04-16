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
  AI_STATUS: 'ai_status'
};

module.exports = SOCKET_EVENTS;
