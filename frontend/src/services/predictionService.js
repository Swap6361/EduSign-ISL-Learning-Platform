import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL 
  ? process.env.REACT_APP_BACKEND_URL 
  : 'http://localhost:5001';

let socket = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connect = () => {
  if (socket?.connected) {
    console.log('✅ Alphabet WebSocket already connected');
    return Promise.resolve(socket);
  }

  if (isConnecting) {
    console.log('⏳ Alphabet WebSocket connection in progress...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (socket?.connected) {
          clearInterval(checkInterval);
          resolve(socket);
        }
      }, 100);
    });
  }

  return new Promise((resolve, reject) => {
    isConnecting = true;
    console.log(`🔌 Connecting Alphabet WebSocket to ${BACKEND_URL}...`);

    socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Alphabet WebSocket connected:', socket.id);
      isConnecting = false;
      reconnectAttempts = 0;
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Alphabet connection error:', error);
      isConnecting = false;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        reject(new Error(`Failed to connect to alphabet backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      }
      reconnectAttempts++;
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Alphabet WebSocket disconnected');
    });

    socket.on('error', (error) => {
      console.error('❌ Alphabet WebSocket error:', error);
    });
  });
};

const sendLandmarks = (features) => {
  if (!socket || !socket.connected) {
    console.warn('⚠️ Alphabet WebSocket not connected. Attempting to reconnect...');
    connect().catch(err => console.error('Failed to reconnect:', err));
    return;
  }

  if (!Array.isArray(features) || features.length === 0) {
    console.warn('⚠️ Invalid features array');
    return;
  }

  socket.emit('predict', { landmarks: features });
};

const onPrediction = (callback) => {
  if (!socket) {
    connect()
      .then(() => socket.on('prediction', callback))
      .catch(err => console.error('Failed to connect for prediction listener:', err));
  } else {
    socket.on('prediction', callback);
  }
};

const offPrediction = (callback) => {
  if (socket) {
    socket.off('prediction', callback);
  }
};

const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Alphabet WebSocket disconnected');
  }
};

export default {
  connect,
  sendLandmarks,
  onPrediction,
  offPrediction,
  disconnect
};