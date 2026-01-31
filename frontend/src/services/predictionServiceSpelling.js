import io from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5001'; // Port for realtime_wrapper.py (Static Alphabet/Letters)

let socket = null;
let isConnecting = false;

const connect = () => {
    if (socket?.connected) {
        return Promise.resolve(socket);
    }

    if (isConnecting) {
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

        socket = io(BACKEND_URL, {
            reconnection: true,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ [SPELLING] Connected to port 5001');
            isConnecting = false;
            resolve(socket);
        });

        socket.on('connect_error', (err) => {
            console.error('❌ [SPELLING] Connection error:', err);
            isConnecting = false;
        });

        socket.on('disconnect', () => {
            console.warn('⚠️ [SPELLING] Disconnected');
        });
    });
};

const sendLandmarks = (features, targetLetter = '') => {
    if (!socket || !socket.connected) return;
    socket.emit('predict', { landmarks: features, target: targetLetter });
};

const onPrediction = (callback) => {
    if (!socket) {
        connect().then(() => socket.on('prediction', callback));
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
    }
};

export default {
    connect,
    sendLandmarks,
    onPrediction,
    offPrediction,
    disconnect
};
