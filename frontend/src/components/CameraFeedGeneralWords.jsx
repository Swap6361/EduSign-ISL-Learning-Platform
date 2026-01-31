import React, { useRef, useEffect, useState } from 'react';
import { Holistic, FACEMESH_TESSELATION, POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import predictionServiceGeneralWords from '../services/predictionServiceGeneralWords';

const SEQ_LEN = 30; // Sequence length for motion recognition
const FACE_LM = 468;
const POSE_LM = 33;
const HAND_LM = 21;

function CameraFeedGeneralWords({ currentColor, onPrediction, predictionService, useWebSocket = true }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const holisticRef = useRef(null);
    const [sequenceBuffer, setSequenceBuffer] = useState([]);
    const [isReady, setIsReady] = useState(false);

    // Extract landmarks to array
    const lmToArray = (lm, count) => {
        const arr = new Array(count * 3).fill(0);
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

        return [...face, ...pose, ...leftHand, ...rightHand];
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

        // Extract features and add to buffer
        const features = extractFeatures(results);
        const nonZeroRatio = features.filter(x => x !== 0).length / features.length;

        console.log('📊 [GeneralWords] Frame captured:', {
            featureLength: features.length,
            nonZeroRatio: (nonZeroRatio * 100).toFixed(1) + '%',
            bufferSize: sequenceBuffer.length + 1,
            targetSize: SEQ_LEN
        });

        // Update sequence buffer
        setSequenceBuffer(prev => {
            const newBuffer = [...prev, features];

            // Send to backend when buffer is full
            if (newBuffer.length === SEQ_LEN && useWebSocket && nonZeroRatio > 0.3) {
                console.log('📤 [GeneralWords] Sending sequence to backend');
                console.log('  ├─ Sequence length:', SEQ_LEN);
                console.log('  ├─ Feature size:', features.length);
                console.log('  ├─ Target color:', currentColor);
                console.log('  └─ Service available:', !!predictionService);

                try {
                    predictionService.sendPrediction({
                        sequence: newBuffer,
                        target: currentColor
                    });
                    console.log('✅ [GeneralWords] Sequence sent successfully');
                } catch (error) {
                    console.error('❌ [GeneralWords] Error sending sequence:', error);
                }

                // Keep last 15 frames to maintain continuity
                return newBuffer.slice(-15);
            }

            // Keep buffer size manageable
            if (newBuffer.length > SEQ_LEN) {
                return newBuffer.slice(-SEQ_LEN);
            }

            return newBuffer;
        });

        // Send UI updates
        if (onPrediction) {
            const hasHands = results.leftHandLandmarks || results.rightHandLandmarks;
            const hasPose = results.poseLandmarks;

            onPrediction({
                uiOnly: true,
                handsDetected: hasHands,
                poseDetected: hasPose,
                ready: hasHands && hasPose,
                bufferSize: sequenceBuffer.length + 1,
                bufferFull: (sequenceBuffer.length + 1) >= SEQ_LEN
            });
        }
    };

    // Helper to draw connectors
    const drawConnectors = (ctx, landmarks, connections, color, lineWidth) => {
        ctx.strokeStyle = color;
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
    const drawLandmarks = (ctx, landmarks, color, radius) => {
        ctx.fillStyle = color;

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
        const initCamera = async () => {
            console.log('🎥 [GeneralWords] Initializing MediaPipe Holistic camera');

            if (!videoRef.current) {
                console.error('❌ [GeneralWords] Video ref not available');
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
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    refineFaceLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
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

                console.log('✅ [GeneralWords] Holistic camera initialized');
            } catch (error) {
                console.error('❌ [GeneralWords] Camera initialization error:', error);
            }
        };

        initCamera();

        return () => {
            console.log('🛑 [GeneralWords] Cleaning up camera');
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (holisticRef.current) {
                holisticRef.current.close();
            }
        };
    }, []);

    // Register prediction listener
    useEffect(() => {
        if (!useWebSocket || !predictionService || !onPrediction) return;

        const handlePrediction = (result) => {
            console.log('📥 [GeneralWords] Prediction received:', result);

            if (result.success) {
                console.log('✅ [GeneralWords] Forwarding prediction to parent:', result.color || result.label);
                onPrediction(result);
            } else {
                console.log('⚠️ [GeneralWords] Prediction failed:', result.error);
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
                    color: 'white',
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
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px'
            }}>
                Buffer: {sequenceBuffer.length}/{SEQ_LEN} frames
            </div>
        </div>
    );
}

export default CameraFeedGeneralWords;
