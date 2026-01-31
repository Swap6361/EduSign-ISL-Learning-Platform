import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket = null;

export const socketService = {
  connect() {
    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('✓ Socket.IO connected');
      });

      socket.on('disconnect', () => {
        console.log('✗ Socket.IO disconnected');
      });
    }
    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  emit(event, data) {
    if (socket) {
      socket.emit(event, data);
    }
  },

  on(event, callback) {
    if (socket) {
      socket.on(event, callback);
    }
  },

  off(event, callback) {
    if (socket) {
      socket.off(event, callback);
    }
  }
};

export default socketService;