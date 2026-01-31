import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_COLORS_BACKEND_URL
    ? process.env.REACT_APP_COLORS_BACKEND_URL
    : 'http://localhost:5006';

let socket = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connect = () => {
    if (socket?.connected) {
        console.log('✅ [COLORS] WebSocket already connected');
        return Promise.resolve(socket);
    }

    if (isConnecting) {
        console.log('⏳ [COLORS] WebSocket connection in progress...');
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
        console.log(`🔌 [COLORS] Connecting to ${BACKEND_URL}...`);

        socket = io(BACKEND_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ [COLORS] WebSocket connected:', socket.id);
            isConnecting = false;
            reconnectAttempts = 0;
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ [COLORS] Connection error:', error);
            isConnecting = false;
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                reject(new Error(`Failed to connect to COLORS backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
            }
            reconnectAttempts++;
        });

        socket.on('disconnect', () => {
            console.warn('⚠️ [COLORS] WebSocket disconnected');
        });

        socket.on('error', (error) => {
            console.error('❌ [COLORS] WebSocket error:', error);
        });
    });
};

const sendLandmarks = (features, targetColor = '') => {
    if (!socket || !socket.connected) {
        console.warn('⚠️ [COLORS] WebSocket not connected. Attempting to reconnect...');
        connect().catch(err => console.error('[COLORS] Failed to reconnect:', err));
        return;
    }

    if (!Array.isArray(features) || features.length === 0) {
        console.warn('⚠️ [COLORS] Invalid features array');
        return;
    }

    socket.emit('predict', { landmarks: features, target: targetColor });
};

const sendPrediction = async (data) => {
    try {
        await connect();

        if (!socket || !socket.connected) {
            console.error('❌ [COLORS] Socket not connected');
            return;
        }

        const { sequence, target } = data;

        console.log('📤 [COLORS] Sending sequence:', {
            sequenceLength: sequence?.length,
            target,
            socketId: socket.id
        });

        // Flatten sequence to 2D array [30, 1629]
        const flatSequence = sequence.map(frame => Array.from(frame));

        socket.emit('predict', {
            sequence: flatSequence,
            target: target || ''
        });

    } catch (error) {
        console.error('❌ [COLORS] Error sending prediction:', error);
    }
};

const onPrediction = (callback) => {
    if (!socket) {
        connect()
            .then(() => socket.on('prediction', callback))
            .catch(err => console.error('[COLORS] Failed to connect for prediction listener:', err));
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
        console.log('🔌 [COLORS] WebSocket disconnected');
    }
};

export default {
    connect,
    sendLandmarks,
    sendPrediction,
    onPrediction,
    offPrediction,
    disconnect,
};
