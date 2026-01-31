import React, { useRef, useEffect, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import predictionServiceNumbers from '../services/predictionServiceNumbers';

function normalizeOneHand(lms) {
  if (!lms || lms.length === 0) return new Array(63).fill(0);
  const xs = lms.map(p => p.x);
  const ys = lms.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  return lms.flatMap(p => [
    (p.x - minX) / rangeX,
    (p.y - minY) / rangeY,
    p.z || 0
  ]);
}

function buildFeatureVector(results) {
  let left = new Array(63).fill(0);
  let right = new Array(63).fill(0);
  let leftDetected = false;
  let rightDetected = false;

  if (results.multiHandLandmarks?.length) {
    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness || [];
    for (let i = 0; i < hands.length; i++) {
      const norm = normalizeOneHand(hands[i]);
      const label = handedness[i]?.label || 'Right';
      if (label === 'Left') { left = norm; leftDetected = true; }
      else { right = norm; rightDetected = true; }
    }
  }

  // send ONLY one hand (63). Prefer right if present.
  const features = right.some(v => v !== 0) ? right : left;
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

const CameraFeedNumbers = ({ onPrediction, useWebSocket = true, predictionService: customPredictionService }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  
  const activePredictionService = customPredictionService || predictionServiceNumbers;
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);

  const startCamera = async () => {
    console.log('🎥 Starting numbers camera...');
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

      console.log('✅ Stream obtained');

      if (!videoRef.current) {
        setError('Video element not ready');
        setIsLoading(false);
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;

      let playAttempts = 0;
      const maxAttempts = 10;

      const attemptPlay = async () => {
        playAttempts++;

        if (video.readyState >= 2) {
          try {
            await video.play();
            console.log('✅ Numbers camera playing!');
            
            if (canvasRef.current) {
              canvasRef.current.width = video.videoWidth || 640;
              canvasRef.current.height = video.videoHeight || 480;
            }
            
            setIsCameraActive(true);
            setIsLoading(false);
            
            setTimeout(() => {
              console.log('🤖 Initializing MediaPipe for numbers...');
              initializeMediaPipe();
            }, 800);
            
            return true;
          } catch (playErr) {
            console.warn('⚠️ Play failed:', playErr.message);
            
            if (playAttempts < maxAttempts) {
              setTimeout(attemptPlay, 300);
              return false;
            } else {
              throw playErr;
            }
          }
        } else {
          if (playAttempts < maxAttempts) {
            setTimeout(attemptPlay, 300);
            return false;
          } else {
            throw new Error('Video never reached ready state');
          }
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
    console.log('🛑 Stopping numbers camera...');
    
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => {
        track.stop();
      });
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
    setCurrentPrediction(null);
    frameBuffer = [];
    console.log('✅ Numbers camera stopped');
  };

  const initializeMediaPipe = () => {
    if (!videoRef.current) {
      console.error('❌ Cannot initialize MediaPipe: video ref is null');
      return;
    }

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,  // Only detect one hand for numbers
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
    console.log('✅ MediaPipe initialized for numbers');
  };

  const handleResults = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        const connections = [
          [0,1],[1,2],[2,3],[3,4],
          [0,5],[5,6],[6,7],[7,8],
          [0,9],[9,10],[10,11],[11,12],
          [0,13],[13,14],[14,15],[15,16],
          [0,17],[17,18],[18,19],[19,20],
          [5,9],[9,13],[13,17]
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

    // Numbers use 63 features (single hand)
    const EXPECTED_SIZE = 63;
    
    const { features, leftDetected, rightDetected } = buildFeatureVector(results, EXPECTED_SIZE);
    const nonZeroRatio = features.filter(v => v !== 0).length / features.length;
    const stable = nonZeroRatio > MIN_NONZERO_RATIO ? isStable(features) : false;

    if (nonZeroRatio > MIN_NONZERO_RATIO) {
      framesWithHands += 1;
    } else {
      framesWithHands = 0;
      frameBuffer = [];
    }

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
      console.log('📤 Sending number features to backend, length:', features.length);
      activePredictionService.sendLandmarksNumbers(features);  // Use numbers-specific method
    }
  };

  useEffect(() => {
    if (useWebSocket) {
      const handlePred = (result) => {
        console.log('📥 Received number prediction:', result);
        if (!result.uiOnly && result.success) {
          setCurrentPrediction(result);
          if (onPrediction) onPrediction(result);
        }
      };
      activePredictionService.onPredictionNumbers(handlePred);
      return () => activePredictionService.offPredictionNumbers(handlePred);
    }
  }, [useWebSocket, onPrediction, activePredictionService]);

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
            <div style={{ fontSize: '80px', marginBottom: '20px' }}>🔢</div>
            <h3>Numbers Camera Ready</h3>
            <p>Click below to start learning numbers 0-9</p>
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

      {isCameraActive && currentPrediction && (
        <div style={{
          marginTop: '12px',
          padding: '16px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
              {currentPrediction.label}
            </div>
            <div style={{ fontSize: '16px', color: '#666' }}>
              Confidence: {(currentPrediction.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{
            width: '100%',
            height: '12px',
            background: '#eee',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.round(currentPrediction.confidence * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4caf50, #8bc34a)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

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

export default CameraFeedNumbers;