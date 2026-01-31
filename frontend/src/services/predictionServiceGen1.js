import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_GEN1_BACKEND_URL
    ? process.env.REACT_APP_GEN1_BACKEND_URL
    : 'http://localhost:5007';

let socket = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connect = () => {
    if (socket?.connected) {
        console.log('✅ [GEN1] WebSocket already connected');
        return Promise.resolve(socket);
    }

    if (isConnecting) {
        console.log('⏳ [GEN1] WebSocket connection in progress...');
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
        console.log(`🔌 [GEN1] Connecting to ${BACKEND_URL}...`);

        socket = io(BACKEND_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ [GEN1] WebSocket connected:', socket.id);
            isConnecting = false;
            reconnectAttempts = 0;
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ [GEN1] Connection error:', error);
            isConnecting = false;
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                reject(new Error(`Failed to connect to GEN1 backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
            }
            reconnectAttempts++;
        });

        socket.on('disconnect', () => {
            console.warn('⚠️ [GEN1] WebSocket disconnected');
        });

        socket.on('error', (error) => {
            console.error('❌ [GEN1] WebSocket error:', error);
        });
    });
};

const sendLandmarks = (features, targetColor = '') => {
    if (!socket || !socket.connected) {
        console.warn('⚠️ [GEN1] WebSocket not connected. Attempting to reconnect...');
        connect().catch(err => console.error('[GEN1] Failed to reconnect:', err));
        return;
    }

    if (!Array.isArray(features) || features.length === 0) {
        console.warn('⚠️ [GEN1] Invalid features array');
        return;
    }

    socket.emit('predict', { landmarks: features, target: targetColor });
};

const sendPrediction = async (data) => {
    try {
        await connect();

        if (!socket || !socket.connected) {
            console.error('❌ [GEN1] Socket not connected');
            return;
        }

        const { sequence, target } = data;

        console.log('📤 [GEN1] Sending sequence:', {
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
        console.error('❌ [GEN1] Error sending prediction:', error);
    }
};

const onPrediction = (callback) => {
    if (!socket) {
        connect()
            .then(() => socket.on('prediction', callback))
            .catch(err => console.error('[GEN1] Failed to connect for prediction listener:', err));
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
        console.log('🔌 [GEN1] WebSocket disconnected');
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
