import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket = null;
let predictionCallback = null;

export const connectSocket = (onPrediction) => {
  if (socket && socket.connected) {
    console.log('Socket already connected');
    return;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  predictionCallback = onPrediction;

  socket.on('connect', () => {
    console.log('✓ WebSocket connected:', socket.id);
  });

  socket.on('connected', (data) => {
    console.log('✓ Server acknowledged connection:', data);
  });

  socket.on('prediction_result', (result) => {
    console.log('WebSocket prediction:', result);
    if (predictionCallback) {
      predictionCallback(result);
    }
  });

  socket.on('prediction_error', (error) => {
    console.error('WebSocket prediction error:', error);
    if (predictionCallback) {
      predictionCallback({
        success: false,
        error: error.error,
        label: null,
        confidence: 0
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('✗ WebSocket disconnected');
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    predictionCallback = null;
    console.log('✓ WebSocket disconnected manually');
  }
};

export const sendFrame = (imageData, landmarks = null) => {
  if (!socket || !socket.connected) {
    console.error('Socket not connected');
    return;
  }

  if (landmarks) {
    socket.emit('predict_landmarks', { landmarks });
  } else if (imageData) {
    socket.emit('predict_frame', { image: imageData });
  }
};

export const isSocketConnected = () => {
  return socket && socket.connected;
};