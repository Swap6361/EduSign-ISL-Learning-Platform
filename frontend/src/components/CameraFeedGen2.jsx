import React, { useRef, useEffect, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import predictionServiceDefault from '../services/predictionService';

function normalizeOneHand(lms) {
  const xs = lms.map(p => p.x), ys = lms.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return lms.flatMap(p => [p.x - minX, p.y - minY, p.z]);
}

function buildFeatureVector(results, expectedSize = 63) {
  let left = new Array(63).fill(0);
  let right = new Array(63).fill(0);
  let leftDetected = false;
  let rightDetected = false;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness || [];

    for (let i = 0; i < hands.length; i++) {
      const lms = hands[i];
      const label = handedness[i]?.label || 'Right';
      const norm = normalizeOneHand(lms);
      if (label === 'Left') { left = norm; leftDetected = true; }
      else { right = norm; rightDetected = true; }
    }
  }

  const features = expectedSize === 63
    ? (right.some(v => v !== 0) ? right : left)
    : [...left, ...right];

  return { features, leftDetected, rightDetected };
}

const STABILITY_BUFFER = 3;
const VAR_THRESHOLD = 0.12;
const MIN_NONZERO_RATIO = 0.25;
const MIN_FRAMES_FOR_FORCE_SEND = 4;
const PREDICTION_COOLDOWN_MS = 350;

let frameBuffer = [];
let framesWithHands = 0;
let lastSendTime = 0;

function isStable(features) {
  if (!features || features.length === 0) return false;
  frameBuffer.push(features);
  if (frameBuffer.length < STABILITY_BUFFER) return false;
  if (frameBuffer.length > STABILITY_BUFFER) frameBuffer.shift();

  let sumVar = 0;
  for (let i = 1; i < frameBuffer.length; i++) {
    let diff = 0;
    for (let j = 0; j < features.length; j++) {
      diff += Math.abs(frameBuffer[i][j] - frameBuffer[i - 1][j]);
    }
    sumVar += diff / features.length;
  }
  const meanVar = sumVar / (frameBuffer.length - 1);
  return meanVar < VAR_THRESHOLD;
}

const CameraFeed = ({ currentLetter, currentDay, currentWord, onPrediction, predictionService: customPredictionService, useWebSocket = true, hideOverlay = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  // Use the label from currentWord, currentLetter, or currentDay
  const currentLabel = currentWord || currentLetter || currentDay;

  // Use provided service, fallback to default Gen2 service
  const predictionService = customPredictionService || predictionServiceDefault;

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    console.log('🎥 Starting camera...');
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (!videoRef.current) {
        setError('Video element not ready');
        setIsLoading(false);
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;

      const attemptPlay = async () => {
        if (video.readyState >= 2) {
          await video.play();
          console.log('✅ Video playing!');

          if (canvasRef.current) {
            canvasRef.current.width = video.videoWidth || 640;
            canvasRef.current.height = video.videoHeight || 480;
          }

          setIsCameraActive(true);
          setIsLoading(false);

          setTimeout(() => {
            console.log('🤖 Initializing MediaPipe for days...');
            initializeMediaPipe();
          }, 800);
        } else {
          setTimeout(attemptPlay, 300);
        }
      };

      await attemptPlay();

    } catch (err) {
      console.error('❌ Camera error:', err);
      setError(err.message || 'Failed to access camera');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    console.log('🛑 Stopping camera...');

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }

    setIsCameraActive(false);
    frameBuffer = [];
  };

  const initializeMediaPipe = () => {
    if (!videoRef.current) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults(handleResults);
    handsRef.current = hands;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current && videoRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
      },
      width: videoRef.current.videoWidth || 640,
      height: videoRef.current.videoHeight || 480
    });

    camera.start();
    cameraRef.current = camera;
    console.log('✅ MediaPipe initialized');
  };

  const handleResults = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hand landmarks
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [0, 9], [9, 10], [10, 11], [11, 12],
          [0, 13], [13, 14], [14, 15], [15, 16],
          [0, 17], [17, 18], [18, 19], [19, 20],
          [5, 9], [9, 13], [13, 17]
        ];

        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;

        connections.forEach(([i, j]) => {
          const x1 = landmarks[i].x * canvas.width;
          const y1 = landmarks[i].y * canvas.height;
          const x2 = landmarks[j].x * canvas.width;
          const y2 = landmarks[j].y * canvas.height;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });

        landmarks.forEach((lm, idx) => {
          const x = lm.x * canvas.width;
          const y = lm.y * canvas.height;
          ctx.fillStyle = idx === 0 ? '#FF0000' : '#00FF00';
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    }

    ctx.restore();

    const EXPECTED_SIZE = 126;
    const { features, leftDetected, rightDetected } = buildFeatureVector(results, EXPECTED_SIZE);
    const nonZeroRatio = features.filter(v => v !== 0).length / features.length;
    const stable = nonZeroRatio > MIN_NONZERO_RATIO ? isStable(features) : false;

    if (nonZeroRatio > MIN_NONZERO_RATIO) {
      framesWithHands += 1;
    } else {
      framesWithHands = 0;
      frameBuffer = [];
    }

    // Send UI-only updates to parent
    if (onPrediction) {
      onPrediction({
        uiOnly: true,
        handsDetected: nonZeroRatio > MIN_NONZERO_RATIO,
        leftDetected,
        rightDetected,
        stable
      });
    }

    const now = performance.now();
    const cooldownElapsed = now - lastSendTime > PREDICTION_COOLDOWN_MS;
    const readyToSend = cooldownElapsed && (
      stable ||
      (framesWithHands >= MIN_FRAMES_FOR_FORCE_SEND && nonZeroRatio > MIN_NONZERO_RATIO + 0.05)
    );

    if (readyToSend) {
      lastSendTime = now;
      console.log('📤 Sending features to backend');
      console.log('  ├─ Feature length:', features.length);
      console.log('  ├─ Stable:', stable);
      console.log('  ├─ Target day:', currentLabel);
      console.log('  └─ Non-zero ratio:', (nonZeroRatio * 100).toFixed(1) + '%');

      if (predictionService && predictionService.sendLandmarks) {
        predictionService.sendLandmarks(features, currentLabel);
      } else {
        console.error('❌ Prediction service not available or missing sendLandmarks method');
      }
    }
  };

  useEffect(() => {
    const handlePred = (result) => {
      console.log('📥 Prediction received:', result);
      if (!result.uiOnly && result.success && onPrediction) {
        onPrediction(result);
      }
    };

    if (predictionService && predictionService.onPrediction) {
      predictionService.onPrediction(handlePred);
      return () => {
        if (predictionService && predictionService.offPrediction) {
          predictionService.offPrediction(handlePred);
        }
      };
    }
  }, [onPrediction, predictionService]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        background: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        minHeight: '450px'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            display: isCameraActive ? 'block' : 'none',
            width: '100%',
            height: 'auto',
            background: '#000'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: isCameraActive ? 'block' : 'none',
            pointerEvents: 'none'
          }}
        />

        {!isCameraActive && (
          <div style={{
            background: '#FFE5D9',
            padding: '60px 20px',
            textAlign: 'center',
            minHeight: '450px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '80px', marginBottom: '20px' }}>📷</div>
            <h3>Camera Ready</h3>
            <p>Click below to start practicing <strong>{currentDay}</strong></p>
            <button
              onClick={startCamera}
              disabled={isLoading}
              style={{
                padding: '15px 40px',
                fontSize: '18px',
                borderRadius: '25px',
                border: 'none',
                background: isLoading ? '#ccc' : 'linear-gradient(135deg, #FF8C42, #FF6B35)',
                color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                marginTop: '20px'
              }}
            >
              {isLoading ? '⏳ Starting...' : '🎥 Start Camera'}
            </button>
            {error && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                background: '#ffebee',
                color: '#c62828',
                borderRadius: '8px',
                maxWidth: '400px'
              }}>
                ❌ {error}
              </div>
            )}
          </div>
        )}

        {isCameraActive && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(76, 175, 80, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            ✓ Camera Active
          </div>
        )}
      </div>

      {isCameraActive && (
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            onClick={stopCamera}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              borderRadius: '20px',
              border: 'none',
              background: '#f44336',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ⏹ Stop Camera
          </button>
        </div>
      )}
    </div>
  );
};

export default CameraFeed;
