import io from 'socket.io-client';

class NumberPredictionService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.predictionCallbacks = [];
  }

  connect() {
    if (this.socket?.connected) {
      console.log('Already connected to numbers server');
      return;
    }

    const backendUrl = 'http://localhost:5002';
    console.log('Connecting to Numbers server:', backendUrl + '...');

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    this.socket.on('connect', () => {
      console.log('✓ Numbers WebSocket connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('✗ Numbers WebSocket disconnected');
      this.isConnected = false;
    });

    this.socket.on('prediction', (data) => {
      console.log('📥 Received number prediction:', data);
      this.predictionCallbacks.forEach(callback => callback(data));
    });

    this.socket.on('connection_response', (data) => {
      console.log('✓ Numbers connection response:', data);
    });
  }

  sendLandmarks(landmarks) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Numbers socket not connected');
      return;
    }

    this.socket.emit('predict', { landmarks });
  }

  onPrediction(callback) {
    this.predictionCallbacks.push(callback);
  }

  offPrediction(callback) {
    this.predictionCallbacks = this.predictionCallbacks.filter(cb => cb !== callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

const numberPredictionService = new NumberPredictionService();
// numberPredictionService.connect(); // Removed auto-connect to prevent unwanted 5002 connection errors

export default numberPredictionService;


