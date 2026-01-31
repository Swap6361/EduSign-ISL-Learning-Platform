import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeed from '../components/CameraFeed';
import ProgressBar from '../components/ProgressBar';
import numberPredictionService from '../services/numberPredictionService';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const NumberLessonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stage } = location.state || { stage: 'Number Game' };

  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const [currentNumberIndex, setCurrentNumberIndex] = useState(0);
  const [completedNumbers, setCompletedNumbers] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [stabilityCount, setStabilityCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [newUnlockedBadge, setNewUnlockedBadge] = useState(null); // New state
  const [handsDetected, setHandsDetected] = useState(false);
  const [stable, setStable] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [mascotMood, setMascotMood] = useState('neutral');
  const [showStageComplete, setShowStageComplete] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [stageStartTime, setStageStartTime] = useState(null);
  const [stageTimer, setStageTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const lastFeedbackTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);

  const REQUIRED_STABILITY = 2;  // Reduced from 3 to 2 for better UX
  const CONFIDENCE_THRESHOLD = 0.60;  // Reduced from 0.65 to 0.60
  const currentNumber = numbers[currentNumberIndex];

  // Load progress on mount
  useEffect(() => {
    const loadUserProgress = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const userProgress = await userProgressService.getProgress(user.uid);
        if (userProgress?.completedNumbers) {
          setCompletedNumbers(userProgress.completedNumbers);
          const firstIncomplete = numbers.findIndex(num => !userProgress.completedNumbers.includes(num));
          if (firstIncomplete >= 0) {
            setCurrentNumberIndex(firstIncomplete);
          }
        }
        if (userProgress?.numbersTime && userProgress.completedNumbers?.length < 10) {
          setStageTimer(userProgress.numbersTime);
        }
      }
      setIsTimerRunning(true);
      setStageStartTime(Date.now());
    };
    loadUserProgress();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setStageTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  // Save timer when leaving
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const user = authService.getCurrentUser();
      if (user && stageTimer > 0) {
        await userProgressService.updateStageTime(user.uid, 'numbers', stageTimer);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [stageTimer]);

  const numberTips = {
    '0': ['Form a circle', 'All fingers together', 'Thumb touches fingers'],
    '1': ['Index finger up', 'Other fingers down', 'Thumb in'],
    '2': ['Two fingers up', 'Index and middle', 'Peace sign'],
    '3': ['Three fingers up', 'Index, middle, ring', 'Thumb touches pinky'],
    '4': ['Four fingers up', 'Thumb in', 'All except pinky'],
    '5': ['All fingers up', 'Hand open', 'High five position'],
    '6': ['Thumb touches pinky', 'Other fingers up', 'OK sign extended'],
    '7': ['Thumb touches ring', 'Other fingers up', 'Seven shape'],
    '8': ['Thumb touches middle', 'Other fingers up', 'Eight shape'],
    '9': ['Thumb touches index', 'Other fingers up', 'Nine shape']
  };

  // Handle prediction
  const handlePrediction = (result) => {
    if (result?.uiOnly) {
      setHandsDetected(result.handsDetected || false);
      setStable(result.stable || false);
      return;
    }

    if (!result?.success || !result?.label) {
      setPredictionHistory([]);
      setStabilityCount(0);
      setMascotMood('neutral');
      return;
    }

    const label = String(result.label);
    const conf = Number(result.confidence || 0);
    const isStable = result.stable !== false;

    console.log('📊 Number Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentNumber, 'Stable:', isStable);
    console.log('🔍 Detailed check:', {
      labelMatches: label === currentNumber,
      confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
      isStable,
      alreadyCompleted: completedNumbers.includes(currentNumber)
    });

    setCurrentPrediction({ label, confidence: conf, stable: isStable });

    if (completedNumbers.includes(currentNumber)) {
      return;
    }

    const labelStr = String(label); const targetStr = String(currentNumber); if (labelStr === targetStr && conf >= CONFIDENCE_THRESHOLD && isStable) {
      console.log('✅ MATCH! Adding to history');
      setPredictionHistory((prev) => {
        const next = [...prev, label].slice(-REQUIRED_STABILITY);
        const matches = next.filter(x => x === currentNumber).length;
        console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
        setStabilityCount(matches);

        if (matches >= REQUIRED_STABILITY && !completedNumbers.includes(currentNumber) && !isAdvancing) {
          const newCompleted = [...completedNumbers, currentNumber];
          setCompletedNumbers(newCompleted);
          setMascotMood('excited');
          persistNumberCompletion(currentNumber, true);

          if (newCompleted.length === numbers.length) {
            handleStageComplete();
          } else {
            advanceToNextNumber();
          }
        }
        return next;
      });
    } else {
      if (label !== currentNumber) {
        setMascotMood('sad');
        persistNumberCompletion(currentNumber, false);
      }
      setPredictionHistory([]);
      setStabilityCount(0);
    }
  };

  const persistNumberCompletion = async (number, isCorrect) => {
    const now = Date.now();
    if (now - lastFeedbackTimeRef.current < 800) return;
    lastFeedbackTimeRef.current = now;

    const user = authService.getCurrentUser();
    if (!user) return;

    if (isCorrect) {
      const result = await userProgressService.completeNumber(user.uid, number);
      if (result.newBadges && result.newBadges.length > 0) {
        // Find badge details
        const allBadges = getAllBadges();
        const badge = allBadges.find(b => b.name === result.newBadges[0]);
        if (badge) {
          setNewUnlockedBadge(badge);
        }
      }
      await userProgressService.setFeedback(user.uid, 'correct');
      await userProgressService.updateStreak(user.uid);

      // Track performance metrics
      const userProgress = await userProgressService.getProgress(user.uid);
      const currentStreak = completedNumbers.length + 1;
      await userProgressService.updatePerformance(user.uid, {
        noMistakeStreak: currentStreak,
        perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
        happyMoodCount: (userProgress?.happyMoodCount || 0) + 1
      });

      // Track first 5 numbers time
      if (currentStreak === 5 && !userProgress?.firstFiveNumbersTime) {
        await userProgressService.updatePerformance(user.uid, {
          firstFiveNumbersTime: stageTimer
        });
      }
    } else {
      await userProgressService.setFeedback(user.uid, 'wrong');
      const userProgress = await userProgressService.getProgress(user.uid);
      await userProgressService.updatePerformance(user.uid, {
        practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
      });
    }
  };

  const handleStageComplete = async () => {
    const user = authService.getCurrentUser();
    if (!user) return;

    setIsTimerRunning(false);
    await userProgressService.updateStageTime(user.uid, 'numbers', stageTimer);
    await userProgressService.completeStage(user.uid, 'numbers', stageTimer);
    setShowStageComplete(true);
    setShowCelebration(true);
  };

  // FIX: Use ref for safe access inside setTimeout
  const completedNumbersRef = useRef(completedNumbers);
  useEffect(() => {
    completedNumbersRef.current = completedNumbers;
  }, [completedNumbers]);

  const advanceToNextNumber = () => {
    if (isAdvancing) return;

    setIsAdvancing(true);
    setShowCelebration(true);

    setTimeout(() => {
      setShowCelebration(false);
      const currentCompleted = completedNumbersRef.current; // access fresh state

      // SMART NAVIGATION: Find the next incomplete number
      let nextIndex = -1;
      for (let i = currentNumberIndex + 1; i < numbers.length; i++) {
        if (!currentCompleted.includes(numbers[i])) {
          nextIndex = i;
          break;
        }
      }

      if (nextIndex !== -1) {
        // Found a gap! Jump to it
        console.log(`⏩ Skipping completed numbers... Jumping to ${numbers[nextIndex]}`);
        setCurrentNumberIndex(nextIndex);
      } else {
        // No more incomplete numbers ahead?
        // Check if we missed any from the beginning
        const missedIndex = numbers.findIndex(n => !currentCompleted.includes(n));

        if (missedIndex !== -1) {
          console.log(`↺ Looping back to incomplete number: ${numbers[missedIndex]}`);
          setCurrentNumberIndex(missedIndex);
        } else {
          // Truly done!
          console.log('🏆 All numbers done. Stage Complete!');
          handleStageComplete();
        }
      }

      // Always clear state after move
      setPredictionHistory([]);
      setStabilityCount(0);
      setCurrentPrediction(null);
      setIsAdvancing(false);
    }, 2000);
  };

  useEffect(() => {
    const handler = (result) => handlePrediction(result);
    numberPredictionService.connect(); // FIX: Ensure socket connects
    numberPredictionService.onPrediction(handler);
    return () => numberPredictionService.offPrediction(handler);
  }, [currentNumber, currentNumberIndex, completedNumbers, isAdvancing]);

  const goToNumber = (index) => {
    if (isAdvancing) return;

    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    setCurrentNumberIndex(index);
  };

  const skipNumber = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentNumberIndex < numbers.length - 1) {
      setCurrentNumberIndex(currentNumberIndex + 1);
    }
  };

  const prevNumber = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentNumberIndex > 0) {
      setCurrentNumberIndex(currentNumberIndex - 1);
    }
  };

  const progressPercentage = Math.round((completedNumbers.length / numbers.length) * 100);

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <button className="back-button" onClick={async () => {
          const user = authService.getCurrentUser();
          if (user && stageTimer > 0) {
            await userProgressService.updateStageTime(user.uid, 'numbers', stageTimer);
          }
          navigate('/beginner-stage');
        }}>
          ← Back to Sign Basics
        </button>
        <h2>🔢 Number Game - Learn 0-9!</h2>
        <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
          🔄 Reset
        </button>
      </div>

      {showResetConfirm && (
        <div className="reset-confirm-modal">
          <div className="reset-confirm-content">
            <h3>⚠️ Reset Progress?</h3>
            <p>Are you sure you want to reset your Number Game progress?</p>
            <div className="reset-buttons">
              <button className="reset-yes" onClick={async () => {
                const user = authService.getCurrentUser();
                if (user) {
                  await userProgressService.resetStage(user.uid, 'numbers');
                  setCompletedNumbers([]);
                  setCurrentNumberIndex(0);
                  setStageTimer(0);
                  setStageStartTime(Date.now());
                  setIsTimerRunning(true);
                }
                setShowResetConfirm(false);
              }}>
                Yes, Reset
              </button>
              <button className="reset-no" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lesson-progress">
        <ProgressBar
          completed={completedNumbers.length}
          total={numbers.length}
          label="Your Progress"
        />
      </div>

      <div className="letter-navigator">
        <h3>Choose a Number</h3>
        <div className="letters-scroll numbers-mode">
          {numbers.map((number, index) => (
            <button
              key={number}
              className={`letter-btn ${index === currentNumberIndex ? 'active' : ''} ${completedNumbers.includes(number) ? 'completed' : ''
                }`}
              onClick={() => goToNumber(index)}
              disabled={isAdvancing}
            >
              {number}
              {completedNumbers.includes(number) && (
                <span className="checkmark">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="lesson-content">
        <div className="reference-panel">
          <div className="reference-card">
            <h3>📖 Learn This Sign</h3>
            <div className="reference-sign">
              <img
                src={`/numbers/${currentNumber}.jpeg`}
                alt={`ASL sign for number ${currentNumber}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '250px',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
                onError={(e) => {
                  // Fallback to text if image doesn't load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="letter-display" style={{ fontSize: '8rem', display: 'none' }}>{currentNumber}</div>
            </div>
            <div className="current-letter-display">
              <h1>{currentNumber}</h1>
              <p>Number {currentNumber}</p>
            </div>
          </div>

          <div className="tips-card">
            <h4>💡 Quick Tips</h4>
            <ul>
              {(numberTips[currentNumber] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                <li key={i}>✓ {tip}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="camera-panel">
          <CameraFeed
            currentLetter={currentNumber}
            onPrediction={handlePrediction}
            useWebSocket={true}
            predictionService={numberPredictionService}
          />
        </div>

        <div className="feedback-panel">
          <h3>🎯 Recognition</h3>

          <div className="prediction-display">
            {currentPrediction ? (
              <>
                <div className={`predicted-letter ${currentPrediction.label === currentNumber ? 'correct' : 'incorrect'
                  }`} style={{ fontSize: '5rem' }}>
                  {currentPrediction.label}
                  {currentPrediction.stable === false && (
                    <span className="unstable-badge">⏳</span>
                  )}
                </div>

                <div className="confidence-meter">
                  <label>Confidence</label>
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${currentPrediction.confidence * 100}%`,
                        background: currentPrediction.confidence >= CONFIDENCE_THRESHOLD
                          ? 'linear-gradient(90deg, #06FFA5, #04CC85)'
                          : 'linear-gradient(90deg, #FFD166, #F0A000)'
                      }}
                    />
                  </div>
                  <span className="confidence-value">
                    {(currentPrediction.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {currentPrediction.label === currentNumber && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                  <div className="feedback-message success">
                    ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                  </div>
                ) : currentPrediction.label === currentNumber && currentPrediction.stable === false ? (
                  <div className="feedback-message hint">
                    ⏳ Good! Hold steady for recognition...
                  </div>
                ) : currentPrediction.label === currentNumber ? (
                  <div className="feedback-message hint">
                    📊 Good! Hold steadier for higher confidence
                  </div>
                ) : (
                  <div className="feedback-message hint">
                    Try to make number {currentNumber}
                  </div>
                )}
              </>
            ) : (
              <div className="prediction-placeholder">
                <span className="hand-icon">✋</span>
                <p>Show your hand sign</p>
              </div>
            )}
          </div>

          <div className="stability-card">
            <h4>Stability Check</h4>
            <div className="stability-indicators">
              {[...Array(REQUIRED_STABILITY)].map((_, i) => (
                <div
                  key={i}
                  className={`stability-dot ${i < stabilityCount ? 'active' : ''}`}
                />
              ))}
            </div>
            <p>{stabilityCount}/{REQUIRED_STABILITY} consistent</p>
          </div>

          <div className="detection-status">
            <div className={`status-item ${handsDetected ? 'active' : ''}`}>
              {handsDetected ? '✓' : '○'} Hands Detected
            </div>
            <div className={`status-item ${stable ? 'active' : ''}`}>
              {stable ? '✓' : '○'} Position Stable
            </div>
          </div>

          <div className="mascot-mood-small">
            {mascotMood === 'excited' && (
              <img
                src="/assets/avatar/mascot_excited.png"
                alt="Excited mascot"
                className="mascot-mood-img"
              />
            )}
            {mascotMood === 'sad' && (
              <img
                src="/assets/avatar/mascot_sad.png"
                alt="Sad mascot"
                className="mascot-mood-img"
              />
            )}
            {mascotMood === 'neutral' && (
              <img
                src="/assets/avatar/mascot.png"
                alt="Mascot"
                className="mascot-mood-img"
              />
            )}
          </div>
        </div>
      </div>

      <div className="lesson-controls">
        <button
          className="control-btn prev"
          onClick={prevNumber}
          disabled={currentNumberIndex === 0 || isAdvancing}
        >
          ← Previous
        </button>
        <button className="control-btn pause">⏸ Pause</button>
        <button
          className="control-btn skip"
          onClick={skipNumber}
          disabled={currentNumberIndex === numbers.length - 1 || isAdvancing}
        >
          Skip →
        </button>
      </div>

      {showCelebration && (
        <div className="celebration-modal">
          <div className="celebration-content" style={{ maxWidth: '400px', padding: '15px' }}>
            <img
              src="/assets/avatar/mascot_hat.png"
              alt="Mascot with Hat"
              className="celebration-mascot"
              style={{ width: '100px', height: '100px', margin: '0 auto 5px', display: 'block', position: 'relative', left: '60px' }}
            />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🎉 Excellent!</h1>
            <div className="celebration-letter" style={{ fontSize: '3rem', margin: '5px 0' }}>{currentNumber}</div>
            <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Number {currentNumber} completed!</p>
            <div className="celebration-progress" style={{ fontSize: '0.8rem' }}>
              {completedNumbers.length}/{numbers.length} Numbers Mastered ({progressPercentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Badge Celebration Modal */}
      <CelebrationModal
        badge={newUnlockedBadge}
        onClose={() => setNewUnlockedBadge(null)}
      />

      {showStageComplete && (
        <div className="stage-complete-modal">
          <Confetti width={window.innerWidth} height={window.innerHeight} />
          <div className="stage-complete-content" style={{ padding: '20px' }}>
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Mascot with Hat and Glasses"
              className="badge-mascot mascot-bounce"
              style={{ width: '90px', marginBottom: '5px' }}
            />
            <h1 style={{ fontSize: '1.8rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Number Game Mastered!</h1>
            <h2 style={{ fontSize: '1.1rem', color: '#ff8c42', marginBottom: '10px' }}>Sign Basics Adventure Complete!</h2>

            <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '2px solid #48BB78' }}>
              <p style={{ fontSize: '1rem', color: '#2F855A', margin: '2px 0', fontWeight: 'bold' }}>👓 Smarty Avatar Unlocked!</p>
              <p style={{ fontSize: '0.8rem', color: '#4A5568', margin: '0' }}>Hat + Glasses! You look smarter now!</p>
            </div>

            <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
              <img src="/assets/badges/badge_num_master.png" alt="Number Master Badge" className="badge-icon-img" style={{ width: '50px', height: '50px', marginBottom: '5px' }} />
              <p style={{ fontSize: '0.9rem', color: '#2D3748', margin: '0' }}>You received the <strong>Number Master</strong> badge!</p>
            </div>

            <button
              className="btn-primary"
              style={{ fontSize: '1.1rem', padding: '10px 30px', background: '#FF8C42', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 140, 66, 0.4)' }}
              onClick={() => {
                setShowStageComplete(false);
                navigate('/dashboard');
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumberLessonPage;

