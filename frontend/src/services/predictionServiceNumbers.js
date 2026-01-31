import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL 
  ? process.env.REACT_APP_BACKEND_URL 
  : 'http://localhost:5002';

let socketNumbers = null;
let isConnectingNumbers = false;
let reconnectAttemptsNumbers = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connectNumbers = () => {
  if (socketNumbers?.connected) {
    console.log('✅ Numbers WebSocket already connected');
    return Promise.resolve(socketNumbers);
  }

  if (isConnectingNumbers) {
    console.log('⏳ Numbers WebSocket connection in progress...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (socketNumbers?.connected) {
          clearInterval(checkInterval);
          resolve(socketNumbers);
        }
      }, 100);
    });
  }

  return new Promise((resolve, reject) => {
    isConnectingNumbers = true;
    console.log(`🔌 Connecting Numbers WebSocket to ${BACKEND_URL}...`);

    socketNumbers = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      transports: ['websocket', 'polling']
    });

    socketNumbers.on('connect', () => {
      console.log('✅ Numbers WebSocket connected:', socketNumbers.id);
      isConnectingNumbers = false;
      reconnectAttemptsNumbers = 0;
      resolve(socketNumbers);
    });

    socketNumbers.on('connect_error', (error) => {
      console.error('❌ Numbers connection error:', error);
      isConnectingNumbers = false;
      if (reconnectAttemptsNumbers >= MAX_RECONNECT_ATTEMPTS) {
        reject(new Error(`Failed to connect to numbers backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      }
      reconnectAttemptsNumbers++;
    });

    socketNumbers.on('disconnect', () => {
      console.warn('⚠️ Numbers WebSocket disconnected');
    });

    socketNumbers.on('error', (error) => {
      console.error('❌ Numbers WebSocket error:', error);
    });
  });
};

const sendLandmarksNumbers = (features) => {
  if (!socketNumbers || !socketNumbers.connected) {
    console.warn('⚠️ Numbers WebSocket not connected. Attempting to reconnect...');
    connectNumbers().catch(err => console.error('Failed to reconnect:', err));
    return;
  }

  if (!Array.isArray(features) || features.length === 0) {
    console.warn('⚠️ Invalid features array for numbers');
    return;
  }

  socketNumbers.emit('predict', { landmarks: features }, (response) => {
    if (response?.error) {
      console.error('❌ Numbers backend error:', response.error);
    }
  });
};

const onPredictionNumbers = (callback) => {
  if (!socketNumbers) {
    connectNumbers()
      .then(() => socketNumbers.on('prediction', callback))
      .catch(err => console.error('Failed to connect for prediction listener:', err));
  } else {
    socketNumbers.on('prediction', callback);
  }
};

const offPredictionNumbers = (callback) => {
  if (socketNumbers) {
    socketNumbers.off('prediction', callback);
  }
};

const disconnectNumbers = () => {
  if (socketNumbers) {
    socketNumbers.disconnect();
    socketNumbers = null;
    console.log('🔌 Numbers WebSocket disconnected');
  }
};

export default {
  connectNumbers,
  sendLandmarksNumbers,
  onPredictionNumbers,
  offPredictionNumbers,
  disconnectNumbers
};