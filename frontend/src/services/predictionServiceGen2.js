import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_GEN2_BACKEND_URL
  ? process.env.REACT_APP_GEN2_BACKEND_URL
  : 'http://localhost:5008';

let socket = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connect = () => {
  if (socket?.connected) {
    console.log('✅ Gen2 WebSocket already connected');
    return Promise.resolve(socket);
  }

  if (isConnecting) {
    console.log('⏳ Gen2 WebSocket connection in progress...');
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
    console.log(`🔌 Connecting Gen2 WebSocket to ${BACKEND_URL}...`);

    socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5008,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Gen2 WebSocket connected:', socket.id);
      isConnecting = false;
      reconnectAttempts = 0;
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Gen2 connection error:', error);
      isConnecting = false;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        reject(new Error(`Failed to connect to Gen2 backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      }
      reconnectAttempts++;
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Gen2 WebSocket disconnected');
    });

    socket.on('error', (error) => {
      console.error('❌ Gen2 WebSocket error:', error);
    });
  });
};

const sendLandmarks = (features) => {
  if (!socket || !socket.connected) {
    console.warn('⚠️ Gen2 WebSocket not connected. Attempting to reconnect...');
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
    console.log('🔌 Gen2 WebSocket disconnected');
  }
};

export default {
  connect,
  sendLandmarks,
  onPrediction,
  offPrediction,
  disconnect
};
