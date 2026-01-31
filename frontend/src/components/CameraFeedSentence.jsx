import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';

const SEQ_LEN = 60; // Sentence model expects 60 frames

const CameraFeedSentence = ({
    sentenceService,
    spellingService,
    spellingMode,
    targetLetter,
    cameraEnabled,
    onPrediction,
    onHandsDetected
}) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const holisticRef = useRef(null);
    const sequenceBufferRef = useRef([]);
    const [isReady, setIsReady] = useState(false);

    // --- Landmark Extraction Logic ---

    // Standard Holistic Extraction (for Sentences) - Matches Python Script
    const extractFeatures = (results) => {
        const features = [];

        const pushLandmarks = (landmarks, count) => {
            for (let i = 0; i < count; i++) {
                if (landmarks && landmarks[i]) {
                    features.push(landmarks[i].x, landmarks[i].y, landmarks[i].z);
                } else {
                    features.push(0, 0, 0);
                }
            }
        };

        // Order: Face (468) -> Pose (33) -> Left Hand (21) -> Right Hand (21)
        pushLandmarks(results.faceLandmarks, 468);
        pushLandmarks(results.poseLandmarks, 33);
        pushLandmarks(results.leftHandLandmarks, 21);
        pushLandmarks(results.rightHandLandmarks, 21);

        return features;
    };

    // 2. Spelling Mode - EXACT COPY of working logic from CameraFeed.jsx
    const extractHandFeaturesForSpelling = (results) => {
        // This is the EXACT normalizeOneHand function from working CameraFeed.jsx
        function normalizeOneHand(lms) {
            const xs = lms.map(p => p.x), ys = lms.map(p => p.y);
            const minX = Math.min(...xs), minY = Math.min(...ys);
            return lms.flatMap(p => [p.x - minX, p.y - minY, p.z]);
        }

        let left = new Array(63).fill(0);
        let right = new Array(63).fill(0);

        // Convert Holistic's format to Hands format for processing
        const multiHandLandmarks = [];
        const multiHandedness = [];

        if (results.leftHandLandmarks) {
            multiHandLandmarks.push(results.leftHandLandmarks);
            multiHandedness.push({ label: 'Left' });
        }
        if (results.rightHandLandmarks) {
            multiHandLandmarks.push(results.rightHandLandmarks);
            multiHandedness.push({ label: 'Right' });
        }

        // EXACT same processing as CameraFeed.jsx buildFeatureVector
        if (multiHandLandmarks && multiHandLandmarks.length > 0) {
            const hands = multiHandLandmarks;
            const handedness = multiHandedness || [];

            for (let i = 0; i < hands.length; i++) {
                const lms = hands[i];
                const label = handedness[i]?.label || 'Right';
                const norm = normalizeOneHand(lms);
                if (label === 'Left') {
                    left = norm;
                } else {
                    right = norm;
                }
            }
        }

        // CRITICAL: Always return 126 features (left + right), same as alphabet
        const features = [...left, ...right];
        return features;
    };

    // --- Drawing Logic ---
    const drawResults = useCallback((results) => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Match canvas size to video
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // Draw connections
        if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, '#00FF00', 2);
            drawLandmarks(ctx, results.poseLandmarks, '#FF0000', 1);
        }
        if (results.leftHandLandmarks) {
            drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, '#CC0000', 3);
            drawLandmarks(ctx, results.leftHandLandmarks, '#FF0000', 2);
        }
        if (results.rightHandLandmarks) {
            drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, '#0000CC', 3);
            drawLandmarks(ctx, results.rightHandLandmarks, '#0000FF', 2);
        }
        ctx.restore();

        // Draw Buffer Progress (Only in Sentence Mode)
        if (!spellingMode) {
            const bufferLen = sequenceBufferRef.current.length;
            drawBufferOverlay(ctx, bufferLen);
        }
    }, [spellingMode]);

    const drawBufferOverlay = (ctx, bufferLen) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const barWidth = 200;
        const barHeight = 10;
        const x = (width - barWidth) / 2;
        const y = height - 40;

        // Background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 25, barWidth + 20, barHeight + 35, 12);
        ctx.fill();

        // Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';

        // Simple continuous text
        const statusText = `Buffer: ${bufferLen}/${SEQ_LEN}`;

        // Green text when full/active
        if (bufferLen >= SEQ_LEN) {
            ctx.fillStyle = '#04CC85';
        }

        ctx.fillText(statusText, width / 2, y - 5);

        // Bar Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 5);
        ctx.fill();

        // Bar Fill
        const fillWidth = Math.min((bufferLen / SEQ_LEN) * barWidth, barWidth);

        // Solid Green when full, Yellow when filling
        ctx.fillStyle = bufferLen >= SEQ_LEN ? '#04CC85' : '#FFD166';

        ctx.beginPath();
        ctx.roundRect(x, y, fillWidth, barHeight, 5);
        ctx.fill();
    };

    const drawConnectors = (ctx, landmarks, connections, color, lineWidth) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        for (const connection of connections) {
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            if (start && end) {
                ctx.beginPath();
                ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
                ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
                ctx.stroke();
            }
        }
    };

    const drawLandmarks = (ctx, landmarks, color, radius) => {
        ctx.fillStyle = color;
        for (const landmark of landmarks) {
            if (landmark) {
                ctx.beginPath();
                ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    };

    // --- Main Loop ---
    const onResults = useCallback((results) => {
        const hasHands = results.leftHandLandmarks || results.rightHandLandmarks;
        if (onHandsDetected) onHandsDetected(!!hasHands);

        // Draw visual feedback
        drawResults(results);

        // 1. Sentence Mode
        if (!spellingMode) {
            const hasPose = results.poseLandmarks && results.poseLandmarks.length > 0;

            if (hasPose) {
                const features = extractFeatures(results);
                sequenceBufferRef.current.push(features);

                // Batch Mode (Capture 60 -> Send -> Clear -> Repeat)
                // User requested "start from 1 again" after 60
                if (sequenceBufferRef.current.length === SEQ_LEN) {
                    if (sentenceService && sentenceService.sendSequence) {
                        sentenceService.sendSequence(sequenceBufferRef.current);
                    }
                    sequenceBufferRef.current = []; // Reset buffer to start from 0
                }
            } else {
                // Optional: Clear buffer if pose lost to ensure clean capture?
                // For batch mode, it's often good to reset if user leaves frame
                if (sequenceBufferRef.current.length > 0) sequenceBufferRef.current = [];
            }
        }
        // 2. Spelling Mode
        else {
            if (hasHands) {
                const handFeatures = extractHandFeaturesForSpelling(results);
                if (spellingService && spellingService.sendLandmarks) {
                    spellingService.sendLandmarks(handFeatures, targetLetter);
                }
            }
        }
    }, [spellingMode, spellingService, sentenceService, targetLetter, onHandsDetected, drawResults]);

    // --- Init Effect ---
    useEffect(() => {
        if (!cameraEnabled) {
            console.log('📷 [CameraFeed] Camera disabled, waiting...');
            setIsReady(false);
            return;
        }

        console.log('📷 [CameraFeed] Initializing...');

        let holistic = null;
        let camera = null;

        const init = async () => {
            if (!videoRef.current) return;

            try {
                holistic = new Holistic({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
                });

                holistic.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    refineFaceLandmarks: true,
                });

                holistic.onResults(onResults);

                camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (holistic) {
                            await holistic.send({ image: videoRef.current });
                        }
                    },
                    width: 640,
                    height: 480,
                });

                await camera.start();
                cameraRef.current = camera;
                holisticRef.current = holistic;
                setIsReady(true);
                console.log('✅ [CameraFeed] Camera started');

                // Connect Services
                if (sentenceService && sentenceService.connect) sentenceService.connect();
                if (spellingService && spellingService.connect) spellingService.connect();

            } catch (err) {
                console.error('❌ [CameraFeed] Error initializing:', err);
            }
        };

        init();

        return () => {
            console.log('🛑 [CameraFeed] Cleanup');
            if (camera) camera.stop();
            if (holistic) holistic.close();
            if (sentenceService && sentenceService.disconnect) sentenceService.disconnect();
            if (spellingService && spellingService.disconnect) spellingService.disconnect();
        };
    }, [cameraEnabled, onResults, sentenceService, spellingService]);


    const [isConnected, setIsConnected] = useState(false);

    // Monitor Connection Status
    useEffect(() => {
        const checkConnection = () => {
            if (!spellingMode && sentenceService) {
                setIsConnected(sentenceService.isConnected());
            } else if (spellingMode && spellingService) {
                // Assuming spelling service has isConnected too, or just mock it for now
                setIsConnected(true);
            }
        };

        const interval = setInterval(checkConnection, 1000);
        checkConnection();

        return () => clearInterval(interval);
    }, [spellingMode, sentenceService, spellingService]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
                ref={videoRef}
                style={{ display: 'none' }}
                autoPlay
                playsInline
            />
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-xl)',
                }}
            />

            {/* Loading State */}
            {!isReady && cameraEnabled && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    color: 'var(--primary-orange)', fontWeight: 'bold', background: 'white',
                    padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-md)'
                }}>
                    Loading Camera AI...
                </div>
            )}

            {/* Disconnected State (Only if Ready but not Connected) */}
            {isReady && !isConnected && !spellingMode && (
                <div style={{
                    position: 'absolute', top: '20px', right: '20px',
                    color: 'white', fontWeight: 'bold', background: '#EF4444', // Red-500
                    padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                    <span>⚠️ Disconnected (Port 5010)</span>
                </div>
            )}
        </div>
    );
};

export default CameraFeedSentence;
