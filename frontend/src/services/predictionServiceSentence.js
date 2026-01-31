/**
 * predictionServiceSentence.js - WebSocket service for sentence recognition
 * Connects to port 5010
 */

import { io } from 'socket.io-client';

class PredictionServiceSentence {
    constructor() {
        this.socket = null;
        this.listeners = [];
    }

    connect() {
        if (this.socket?.connected) {
            console.log('🔵 [SENTENCE] Already connected');
            return;
        }

        console.log('🔌 [SENTENCE] Connecting to http://localhost:5010...');

        this.socket = io('http://localhost:5010', {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        this.socket.on("connect_error", (err) => {
            console.error("❌ [SENTENCE] Connection Error:", err.message);
        });

        this.socket.io.on("open", () => {
            console.log("🔌 [SENTENCE] Transport open!");
        });

        this.socket.io.on("packet", (packet) => {
            console.log("📦 [SENTENCE] Packet received:", packet);
        });

        this.socket.on('connect', () => {
            console.log('✅ [SENTENCE] Connected to port 5010');
        });

        this.socket.on('connection_response', (data) => {
            console.log('📥 [SENTENCE] Connection response:', data);
        });

        this.socket.on('prediction', (result) => {
            console.log('📥 [SENTENCE] Prediction received:', result);
            this.listeners.forEach(callback => callback(result));
        });

        this.socket.on('disconnect', () => {
            console.warn('⚠️ [SENTENCE] Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ [SENTENCE] Connection error:', error.message);
        });
    }

    disconnect() {
        if (this.socket) {
            console.log('🔌 [SENTENCE] Disconnecting...');
            this.socket.disconnect();
            this.socket = null;
            this.listeners = [];
        }
    }

    sendSequence(sequence) {
        if (this.socket?.connected) {
            this.socket.emit('predict', { sequence });
        } else {
            console.warn('⚠️ [SENTENCE] Not connected - cannot send sequence');
        }
    }

    onPrediction(callback) {
        this.listeners.push(callback);
    }

    offPrediction(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    isConnected() {
        return this.socket?.connected || false;
    }
}

export default new PredictionServiceSentence();
