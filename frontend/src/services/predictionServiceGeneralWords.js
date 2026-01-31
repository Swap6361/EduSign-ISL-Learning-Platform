import io from 'socket.io-client';

const BACKEND_URL = typeof process !== 'undefined' && process.env?.REACT_APP_GENERAL_WORDS_BACKEND_URL
    ? process.env.REACT_APP_GENERAL_WORDS_BACKEND_URL
    : 'http://localhost:5007';

let socket = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connect = () => {
    if (socket?.connected) {
        console.log('✅ [GENERAL_WORDS] WebSocket already connected');
        return Promise.resolve(socket);
    }

    if (isConnecting) {
        console.log('⏳ [GENERAL_WORDS] WebSocket connection in progress...');
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
        console.log(`🔌 [GENERAL_WORDS] Connecting to ${BACKEND_URL}...`);

        socket = io(BACKEND_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ [GENERAL_WORDS] WebSocket connected:', socket.id);
            isConnecting = false;
            reconnectAttempts = 0;
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ [GENERAL_WORDS] Connection error:', error);
            isConnecting = false;
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                reject(new Error(`Failed to connect to GENERAL_WORDS backend after ${MAX_RECONNECT_ATTEMPTS} attempts`));
            }
            reconnectAttempts++;
        });

        socket.on('disconnect', () => {
            console.warn('⚠️ [GENERAL_WORDS] WebSocket disconnected');
        });

        socket.on('error', (error) => {
            console.error('❌ [GENERAL_WORDS] WebSocket error:', error);
        });
    });
};

const sendLandmarks = (features, targetColor = '') => {
    if (!socket || !socket.connected) {
        console.warn('⚠️ [GENERAL_WORDS] WebSocket not connected. Attempting to reconnect...');
        connect().catch(err => console.error('[GENERAL_WORDS] Failed to reconnect:', err));
        return;
    }

    if (!Array.isArray(features) || features.length === 0) {
        console.warn('⚠️ [GENERAL_WORDS] Invalid features array');
        return;
    }

    socket.emit('predict', { landmarks: features, target: targetColor });
};

const sendPrediction = async (data) => {
    try {
        await connect();

        if (!socket || !socket.connected) {
            console.error('❌ [GENERAL_WORDS] Socket not connected');
            return;
        }

        const { sequence, target } = data;

        console.log('📤 [GENERAL_WORDS] Sending sequence:', {
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
        console.error('❌ [GENERAL_WORDS] Error sending prediction:', error);
    }
};

const onPrediction = (callback) => {
    if (!socket) {
        connect()
            .then(() => socket.on('prediction', callback))
            .catch(err => console.error('[GENERAL_WORDS] Failed to connect for prediction listener:', err));
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
        console.log('🔌 [GENERAL_WORDS] WebSocket disconnected');
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
