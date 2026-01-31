import React, { useRef, useEffect, useState } from 'react';
import { Holistic, FACEMESH_TESSELATION, POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';

const SEQ_LEN = 30; // Sequence length (REQUIRED by model)
const FACE_LM = 468;
const POSE_LM = 33;
const HAND_LM = 21;

function CameraFeedAZWords({ currentword, onPrediction, predictionService, useWebSocket = true, cameraEnabled = true }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const holisticRef = useRef(null);
    const sequenceBufferRef = useRef([]);
    const [bufferSize, setBufferSize] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const lastPredictionTimeRef = useRef(0);

    // Extract landmarks to Float32Array for better performance
    const lmToArray = (lm, count) => {
        const arr = new Float32Array(count * 3);
        if (lm && lm.length > 0) {
            for (let i = 0; i < Math.min(count, lm.length); i++) {
                const p = lm[i];
                arr[i * 3] = p.x || 0;
                arr[i * 3 + 1] = p.y || 0;
                arr[i * 3 + 2] = p.z || 0;
            }
        }
        return arr;
    };

    // Extract all features (face + pose + hands)
    const extractFeatures = (results) => {
        const face = lmToArray(results.faceLandmarks, FACE_LM);
        const pose = lmToArray(results.poseLandmarks, POSE_LM);
        const leftHand = lmToArray(results.leftHandLandmarks, HAND_LM);
        const rightHand = lmToArray(results.rightHandLandmarks, HAND_LM);

        return new Float32Array([...face, ...pose, ...leftHand, ...rightHand]);
    };

    // Process holistic results
    const onResults = (results) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // Draw landmarks
        if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, '#00FF00', 2);
            drawLandmarks(ctx, results.poseLandmarks, '#FF0000', 2);
        }

        if (results.leftHandLandmarks) {
            drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, '#CC0000', 2);
            drawLandmarks(ctx, results.leftHandLandmarks, '#FF0000', 2);
        }

        if (results.rightHandLandmarks) {
            drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, '#0000CC', 2);
            drawLandmarks(ctx, results.rightHandLandmarks, '#0000FF', 2);
        }

        // Extract features from EVERY frame for accurate predictions
        const features = extractFeatures(results);
        if (!features) return;

        const nonZeroRatio = Array.from(features).filter(x => x !== 0).length / features.length;

        // Update sequence buffer (use ref for performance)
        sequenceBufferRef.current.push(features);

        // Update UI
        setBufferSize(sequenceBufferRef.current.length);

        // When buffer reaches 30 frames, predict and CLEAR (real-time mode)
        const now = Date.now();
        const timeSinceLastPrediction = now - lastPredictionTimeRef.current;

        if (sequenceBufferRef.current.length === SEQ_LEN &&
            useWebSocket &&
            nonZeroRatio > 0.2) {

            // Only send if at least 1 second has passed (prevent spam)
            if (timeSinceLastPrediction >= 1000) {
                lastPredictionTimeRef.current = now;

                try {
                    const sequence = sequenceBufferRef.current.map(f => Array.from(f));
                    predictionService.sendPrediction({
                        sequence: sequence,
                        target: currentword
                    });

                    // CLEAR BUFFER completely for next prediction cycle
                    sequenceBufferRef.current = [];
                    setBufferSize(0);
                    console.log('🔄 [AZWords] Buffer cleared - starting fresh');

                } catch (error) {
                    console.error('❌ [AZWords] Error sending prediction:', error);
                }
            }
        }

        // Send UI updates
        if (onPrediction) {
            const hasHands = results.leftHandLandmarks || results.rightHandLandmarks;
            const hasPose = results.poseLandmarks;

            onPrediction({
                uiOnly: true,
                handsDetected: hasHands,
                poseDetected: hasPose,
                ready: hasHands && hasPose,
                bufferSize: sequenceBufferRef.current.length,
                bufferFull: sequenceBufferRef.current.length >= SEQ_LEN
            });
        }
    };

    // Helper to draw connectors
    const drawConnectors = (ctx, landmarks, connections, word, lineWidth) => {
        ctx.strokeStyle = word;
        ctx.lineWidth = lineWidth;

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

    // Helper to draw landmarks
    const drawLandmarks = (ctx, landmarks, word, radius) => {
        ctx.fillStyle = word;

        for (const landmark of landmarks) {
            if (landmark) {
                ctx.beginPath();
                ctx.arc(
                    landmark.x * ctx.canvas.width,
                    landmark.y * ctx.canvas.height,
                    radius,
                    0,
                    2 * Math.PI
                );
                ctx.fill();
            }
        }
    };

    // Initialize MediaPipe Holistic
    useEffect(() => {
        if (!cameraEnabled) {
            console.log('📷 [AZWords] Camera disabled, waiting for manual start');
            return;
        }

        const initCamera = async () => {
            if (!videoRef.current) {
                console.error('❌ [AZWords] Video ref not available');
                return;
            }

            try {
                // Initialize Holistic
                const holistic = new Holistic({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
                    }
                });

                holistic.setOptions({
                    modelComplexity: 0,  // Reduced for faster startup
                    smoothLandmarks: true,
                    refineFaceLandmarks: false,  // Disabled for faster processing
                    minDetectionConfidence: 0.4,
                    minTrackingConfidence: 0.4
                });

                holistic.onResults(onResults);
                holisticRef.current = holistic;

                // Initialize camera
                const camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (holisticRef.current && videoRef.current) {
                            await holisticRef.current.send({ image: videoRef.current });
                        }
                    },
                    width: 640,
                    height: 480
                });

                await camera.start();
                cameraRef.current = camera;
                setIsReady(true);

                console.log('✅ [AZWords] Holistic camera initialized');
            } catch (error) {
                console.error('❌ [AZWords] Camera initialization error:', error);
            }
        };

        initCamera();

        return () => {
            console.log('🛑 [AZWords] Cleaning up camera');
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (holisticRef.current) {
                holisticRef.current.close();
            }
        };
    }, [cameraEnabled]);

    // Register prediction listener
    useEffect(() => {
        if (!useWebSocket || !predictionService || !onPrediction) return;

        const handlePrediction = (result) => {
            if (result.success) {
                onPrediction(result);
            }
        };

        predictionService.onPrediction(handlePrediction);

        return () => {
            predictionService.offPrediction(handlePrediction);
        };
    }, [useWebSocket, predictionService, onPrediction]);

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
                    borderRadius: '12px'
                }}
            />
            {!isReady && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.7)',
                    word: 'white',
                    padding: '20px',
                    borderRadius: '8px'
                }}>
                    Initializing camera...
                </div>
            )}
            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                word: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px'
            }}>
                Buffer: {bufferSize}/{SEQ_LEN} frames
            </div>
        </div>
    );
}

export default CameraFeedAZWords;
