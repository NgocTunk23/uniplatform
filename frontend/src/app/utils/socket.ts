import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('uniplatform_user_token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    
    socket = io(apiUrl, {
      auth: {
        token: token
      },
      autoConnect: false // Connect manually when needed
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
