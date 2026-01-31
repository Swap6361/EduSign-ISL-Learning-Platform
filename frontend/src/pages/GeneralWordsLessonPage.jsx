import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedGeneralWords from '../components/CameraFeedGeneralWords';
import ProgressBar from '../components/ProgressBar';
import predictionServiceGeneralWords from '../services/predictionServiceGeneralWords';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const GeneralWordsLessonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stage } = location.state || { stage: 'beginner' };

  // 40 General Words (24 motion + 16 static)
  // Motion words (24): from motion model
  // Static words (16): from static model
  const generalWords = [
    // Motion words (24) - capitalize first letter for display
    'Afternoon', 'Born', 'Brush', 'Bye', 'Come', 'Cry', 'Go', 'Happy',
    'Hearing', 'Hello', 'Man', 'Morning', 'Name', 'Nice', 'Night', 'Please',
    'Sad', 'Separate', 'Sorry', 'Thankyou', 'Week', 'Welcome', 'Woman', 'Yes',
    // Static words (16) - capitalize first letter for display
    'Bad', 'Drink', 'Food', 'Good', 'Home', 'I,me', 'Like', 'Love',
    'My', 'Namaste', 'Sleep', 'Teacher', 'Today', 'Water', 'You', 'Your'
  ];
  const [currentwordIndex, setcurrentwordIndex] = useState(0);
  const [completedGeneralWords, setcompletedGeneralWords] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [stabilityCount, setStabilityCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [stable, setStable] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [mascotMood, setMascotMood] = useState('neutral'); // neutral | excited | sad
  const [showStageComplete, setShowStageComplete] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [newUnlockedBadge, setNewUnlockedBadge] = useState(null);
  const [stageStartTime, setStageStartTime] = useState(null);
  const [stageTimer, setStageTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const lastFeedbackTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const advanceToNextDayRef = useRef(null);
  const persistDayCompletionRef = useRef(null);
  const handleStageCompleteRef = useRef(null);

  const REQUIRED_STABILITY = 2;  // Reduced from 3 for faster completion
  const CONFIDENCE_THRESHOLD = 0.60;  // Lowered to 60% to match backend
  const currentword = generalWords[currentwordIndex];

  // Load progress on mount and start timer
  useEffect(() => {
    const loadUserProgress = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const userProgress = await userProgressService.getProgress(user.uid);
        if (userProgress?.completedGeneralWords) {
          setcompletedGeneralWords(userProgress.completedGeneralWords);
          // Find first incomplete word or start from beginning
          const firstIncomplete = generalWords.findIndex(word => !userProgress.completedGeneralWords.includes(word));
          if (firstIncomplete >= 0) {
            setcurrentwordIndex(firstIncomplete);
          }
        }
        // Resume timer if stage was in progress
        if (userProgress?.generalWordsTime && userProgress.completedGeneralWords?.length < 40) {
          setStageTimer(userProgress.GeneralWordsTime);
        }
      }
      // Start timer
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

  // Save timer when leaving page
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const user = authService.getCurrentUser();
      if (user && stageTimer > 0) {
        await userProgressService.updateStageTime(user.uid, 'GeneralWords', stageTimer);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [stageTimer]);

  const DayTips = {
    'A': ['Make a fist', 'Thumb points up', 'Keep fingers closed'],
    'B': ['Fingers straight up', 'Thumb across palm', 'Hand vertical'],
    'C': ['Form a C shape', 'Curve all fingers', 'Thumb opposite fingers'],
    'D': ['Index finger up', 'Touch thumb to fingers', 'Form a D shape'],
    'E': ['Curl all fingers', 'Thumb over fingers', 'Make a tight fist'],
    'F': ['Touch thumb to index', 'Other fingers up', 'Make OK sign'],
    'G': ['Point index finger', 'Thumb points sideways', 'Hand horizontal'],
    'H': ['Two fingers extended', 'Point sideways', 'Other fingers down'],
    'I': ['Pinky finger up', 'Make a fist', 'Other fingers down'],
    'J': ['Draw J in air', 'Use pinky finger', 'Move downward with hook'],
    'K': ['Index & middle up', 'Form a V shape', 'Thumb between fingers'],
    'L': ['Index finger up', 'Thumb out', 'Make L shape'],
    'M': ['Three fingers down', 'Thumb under fingers', 'Make a fist'],
    'N': ['Two fingers down', 'Thumb under fingers', 'Similar to M'],
    'O': ['Form a circle', 'Touch fingertips', 'All fingers curved'],
    'P': ['Point down', 'Index finger down', 'Middle finger out'],
    'Q': ['Point down', 'Index & thumb down', 'Similar to G'],
    'R': ['Cross fingers', 'Index over middle', 'Other fingers down'],
    'S': ['Make a fist', 'Thumb over fingers', 'Thumb in front'],
    'T': ['Thumb between fingers', 'Make a fist', 'Thumb pokes out'],
    'U': ['Two fingers up', 'Fingers together', 'V shape upward'],
    'V': ['Two fingers up', 'Fingers apart', 'Peace sign'],
    'W': ['Three fingers up', 'Fingers spread', 'Middle, ring, pinky'],
    'X': ['Bend index finger', 'Hook shape', 'Other fingers down'],
    'Y': ['Thumb & pinky out', 'Shaka sign', 'Other fingers down'],
    'Z': ['Draw Z in air', 'Use index finger', 'Zigzag motion']
  };

  // Handle prediction from camera
  const handlePrediction = useCallback((result) => {
    // Handle UI-only updates (hand detection, stability)
    if (result?.uiOnly) {
      setHandsDetected(result.handsDetected || false);
      setStable(result.stable || false);
      return;
    }

    // Handle actual predictions
    if (!result?.success || !result?.label) {
      // Reset on failed prediction
      setPredictionHistory([]);
      setStabilityCount(0);
      setMascotMood('neutral');
      return;
    }

    const label = String(result.word || result.label).toUpperCase();
    const conf = Number(result.confidence || 0);
    const isStable = result.stable !== false; // Default to true if not specified

    console.log('📊 [GeneralWords] Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentword, 'Index:', currentwordIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

    // Update current prediction display
    setCurrentPrediction({ label, confidence: conf, stable: isStable });

    // CRITICAL: Don't process if we're already advancing
    if (isAdvancing) {
      console.log('⏸ [GeneralWords] Skipping prediction - already advancing');
      return;
    }

    // Check if already completed this word
    if (completedGeneralWords.includes(currentword)) {
      console.log('⚠️ [GeneralWords] word', currentword, 'already completed');
      return;
    }

    // Only accept stable predictions that match the current word (case-insensitive)
    if (label.toUpperCase() === currentword.toUpperCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
      console.log('✅ [GeneralWords] CONDITION MET: Adding to stability counter');
      setPredictionHistory((prev) => {
        console.log('📝 Previous history:', prev);
        const next = [...prev, label].slice(-REQUIRED_STABILITY);
        const matches = next.filter(x => x.toUpperCase() === currentword.toUpperCase()).length;

        console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
        console.log('📊 State check:', {
          matches,
          required: REQUIRED_STABILITY,
          meetsThreshold: matches >= REQUIRED_STABILITY,
          currentword,
          completedGeneralWords,
          alreadyCompleted: completedGeneralWords.includes(currentword),
          isAdvancing
        });
        setStabilityCount(matches);

        // word completed!
        if (matches >= REQUIRED_STABILITY) {
          console.log('🎯 STABILITY REACHED! word:', currentword, 'Completed:', completedGeneralWords, 'isAdvancing:', isAdvancing);

          // Double check not already completed and not advancing
          if (!completedGeneralWords.includes(currentword) && !isAdvancing) {
            console.log('✅ COMPLETING word:', currentword);
            console.log('🚀 About to call advanceToNextDayRef.current');
            console.log('🔍 Ref status:', {
              refExists: !!advanceToNextDayRef.current,
              refType: typeof advanceToNextDayRef.current
            });

            const newCompleted = [...completedGeneralWords, currentword];
            setcompletedGeneralWords(newCompleted);
            setMascotMood('excited');
            if (persistDayCompletionRef.current) {
              persistDayCompletionRef.current(currentword, true);
            }

            // Check if stage is complete (all 40 GeneralWords)
            if (newCompleted.length === generalWords.length) {
              console.log('🏆 ALL GeneralWords COMPLETE!');
              if (handleStageCompleteRef.current) {
                handleStageCompleteRef.current();
              }
            } else {
              // Auto-advance to next word
              console.log('➡️ Triggering advancement...');
              if (advanceToNextDayRef.current) {
                console.log('✅ Calling advanceToNextDayRef.current()');
                advanceToNextDayRef.current();
              } else {
                console.error('❌ ERROR: advanceToNextDayRef.current is NULL or undefined!');
              }
            }
          } else {
            console.log('⚠️ Blocked - already completed or advancing', {
              alreadyCompleted: completedGeneralWords.includes(currentword),
              isAdvancing
            });
          }
        }
        return next;
      });
    } else {
      // Reset stability if wrong word or low confidence
      console.log('❌ CONDITION NOT MET - Resetting stability', {
        labelMatches: label === currentword,
        label,
        currentword,
        confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
        confidence: conf,
        threshold: CONFIDENCE_THRESHOLD,
        isStable
      });

      if (label !== currentword) {
        console.log('❌ Wrong word detected:', label, '(expected:', currentword + ')');
        setMascotMood('sad');
        if (persistDayCompletionRef.current) {
          persistDayCompletionRef.current(currentword, false);
        }
      } else if (!isStable) {
        console.log('⏳ Waiting for stable prediction...');
      } else {
        console.log('⚠️ Low confidence:', (conf * 100).toFixed(0) + '% (need 65%+)');
      }
      setPredictionHistory([]);
      setStabilityCount(0);
    }
  }, [currentword, currentwordIndex, completedGeneralWords, isAdvancing, generalWords.length]);

  const persistDayCompletion = useCallback(async (word, isCorrect) => {
    const user = authService.getCurrentUser();
    if (!user) {
      console.error('❌ [GeneralWords] No user found, cannot save completion');
      return;
    }

    console.log('💾 [GeneralWords] Saving word completion to Firebase:', word, 'isCorrect:', isCorrect);

    if (isCorrect) {
      try {
        const result = await userProgressService.completeWord(user.uid, 'general', word);
        console.log('✅ [GeneralWords] word saved to Firebase:', word, 'Result:', result);

        if (result.newBadges && result.newBadges.length > 0) {
          const allBadges = getAllBadges();
          const badge = allBadges.find(b => b.name === result.newBadges[0]);
          if (badge) {
            setNewUnlockedBadge(badge);
          }
        }

        await userProgressService.setFeedback(user.uid, 'correct');
        await userProgressService.updateStreak(user.uid);

        // Track performance metrics
        const currentStreak = completedGeneralWords.length + 1;
        await userProgressService.updatePerformance(user.uid, {
          noMistakeStreak: currentStreak,
          perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
          happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
        });
      } catch (error) {
        console.error('❌ [GeneralWords] Error saving to Firebase:', error);
      }
    } else {
      await userProgressService.setFeedback(user.uid, 'wrong');
      const userProgress = await userProgressService.getProgress(user.uid);
      await userProgressService.updatePerformance(user.uid, {
        practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
      });
    }
  }, [completedGeneralWords.length]);

  // Handle stage complete
  const handleStageComplete = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (user) {
      // Stop timer and save final time
      setIsTimerRunning(false);
      await userProgressService.updateStageTime(user.uid, 'GeneralWords', stageTimer);

      // Award badge and unlock next stage
      await userProgressService.completeStage(user.uid, 'GeneralWords', stageTimer);
    }

    setShowStageComplete(true);
    setShowCelebration(true);
    setMascotMood('excited');

    // Big celebration
    // confetti already in component
  }, [stageTimer]);

  // Auto-advance to next word
  const advanceToNextDay = useCallback(() => {
    if (isAdvancing) {
      console.log('⏸ [GeneralWords] Already advancing, skipping');
      return;
    }

    console.log('🎯 [GeneralWords] Starting advance from word', currentword, 'index', currentwordIndex);
    setIsAdvancing(true);
    setShowCelebration(true);
    setMascotMood('excited');

    // Celebration (confetti in component)

    // Immediate state reset to allow next word
    setTimeout(() => {
      setShowCelebration(false);
      setMascotMood('neutral');
      setPredictionHistory([]);
      setStabilityCount(0);
      setCurrentPrediction(null);

      if (currentwordIndex < generalWords.length - 1) {
        const nextIndex = currentwordIndex + 1;
        const nextDay = generalWords[nextIndex];

        console.log('➡️ [GeneralWords] Advancing to index', nextIndex, 'word', nextDay);
        setcurrentwordIndex(nextIndex);
      } else {
        console.log('🏆 [GeneralWords] Completed all GeneralWords!');
      }

      console.log('✅ [GeneralWords] Advance complete, resetting isAdvancing to false');
      setIsAdvancing(false);
    }, 1000); // 1 second celebration
  }, [isAdvancing, currentword, currentwordIndex, generalWords.length]);

  // Update refs when functions change
  useEffect(() => {
    advanceToNextDayRef.current = advanceToNextDay;
    persistDayCompletionRef.current = persistDayCompletion;
    handleStageCompleteRef.current = handleStageComplete;
  }, [advanceToNextDay, persistDayCompletion, handleStageComplete]);

  useEffect(() => {
    const handler = (result) => handlePrediction(result);
    predictionServiceGeneralWords.onPrediction(handler);
    console.log('🔄 Re-registered prediction handler for word:', currentword);
    return () => {
      predictionServiceGeneralWords.offPrediction(handler);
    };
  }, [currentword, currentwordIndex, completedGeneralWords, isAdvancing, handlePrediction]);

  // Navigate to specific word (manual navigation)
  const goToDay = (index) => {
    if (isAdvancing) {
      console.log('⏸ Cannot navigate while advancing');
      return;
    }

    console.log('📍 Manual navigation to index', index, 'word', generalWords[index]);

    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    setcurrentwordIndex(index);
  };

  // Skip handler
  const skipDay = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentwordIndex < generalWords.length - 1) {
      setcurrentwordIndex(currentwordIndex + 1);
    }
  };

  // Previous word handler
  const prevDay = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentwordIndex > 0) {
      setcurrentwordIndex(currentwordIndex - 1);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.round((completedGeneralWords.length / generalWords.length) * 100);

  return (
    <div className="lesson-page">
      {/* Header */}
      <div className="lesson-header">
        <button className="back-button" onClick={async () => {
          const user = authService.getCurrentUser();
          if (user && stageTimer > 0) {
            await userProgressService.updateStageTime(user.uid, 'GeneralWords', stageTimer);
          }
          navigate('/dashboard');
        }}>
          ← Back to Dashboard
        </button>
        <h2>🎨 GeneralWords - All 40 GeneralWords!</h2>
        <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
          🔄 Reset
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="reset-confirm-modal">
          <div className="reset-confirm-content">
            <h3>⚠️ Reset Progress?</h3>
            <p>Are you sure you want to reset your GeneralWords Island progress? This will remove all completed GeneralWords and start from the beginning.</p>
            <div className="reset-buttons">
              <button className="reset-yes" onClick={async () => {
                const user = authService.getCurrentUser();
                if (user) {
                  await userProgressService.resetStage(user.uid, 'GeneralWords');
                  setcompletedGeneralWords([]);
                  setcurrentwordIndex(0);
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

      {/* Progress */}
      <div className="lesson-progress">
        <ProgressBar
          completed={completedGeneralWords.length}
          total={generalWords.length}
          label="Your Progress"
        />
      </div>

      {/* word Navigator */}
      <div className="word-navigator">
        <h3>Choose a word</h3>
        <div className="GeneralWords-scroll">
          {generalWords.map((word, index) => (
            <button
              key={word}
              className={`word-btn ${index === currentwordIndex ? 'active' : ''} ${completedGeneralWords.includes(word) ? 'completed' : ''
                }`}
              onClick={() => goToDay(index)}
              disabled={isAdvancing}
            >
              {word}
              {completedGeneralWords.includes(word) && (
                <span className="checkmark">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lesson-content">
        {/* Left Panel - Reference */}
        <div className="reference-panel">
          <div className="reference-card">
            <h3>📖 Learn This Sign</h3>
            <div className="reference-sign">
              <div className="word-display">{currentword}</div>
            </div>
            <div className="current-word-display">
              <h1>{currentword}</h1>
              <p>word {currentword}</p>
              {currentword === 'J' && (
                <p className="motion-hint">⚡ Motion Required</p>
              )}
            </div>
          </div>

          <div className="tips-card">
            <h4>💡 Quick Tips</h4>
            <ul>
              {(DayTips[currentword] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                <li key={i}>✓ {tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Center Panel - Camera */}
        <div className="camera-panel">
          <CameraFeedGeneralWords
            currentword={currentword}
            onPrediction={handlePrediction}
            predictionService={predictionServiceGeneralWords}
            useWebSocket={true}
          />
        </div>

        {/* Right Panel - Feedback */}
        <div className="feedback-panel">
          <h3>🎯 Recognition</h3>

          <div className="prediction-display">
            {currentPrediction ? (
              <>
                <div className={`predicted-word ${currentPrediction.label === currentword ? 'correct' : 'incorrect'
                  }`}>
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

                {currentPrediction.label === currentword && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                  <div className="feedback-message success">
                    ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                  </div>
                ) : currentPrediction.label === currentword && currentPrediction.stable === false ? (
                  <div className="feedback-message hint">
                    ⏳ Good! Hold steady for recognition...
                  </div>
                ) : currentPrediction.label === currentword ? (
                  <div className="feedback-message hint">
                    📊 Good! Hold steadier for higher confidence
                  </div>
                ) : (
                  <div className="feedback-message hint">
                    Try to make word {currentword}
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

          {/* Hand Detection Status */}
          <div className="detection-status">
            <div className={`status-item ${handsDetected ? 'active' : ''}`}>
              {handsDetected ? '✓' : '○'} Hands Detected
            </div>
            <div className={`status-item ${stable ? 'active' : ''}`}>
              {stable ? '✓' : '○'} Position Stable
            </div>
          </div>

          {/* Mascot Mood - Small and below detection */}
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

      {/* Bottom Controls */}
      <div className="lesson-controls">
        <button
          className="control-btn prev"
          onClick={prevDay}
          disabled={currentwordIndex === 0 || isAdvancing}
        >
          ← Previous
        </button>
        <button className="control-btn pause">⏸ Pause</button>
        <button
          className="control-btn skip"
          onClick={skipDay}
          disabled={currentwordIndex === generalWords.length - 1 || isAdvancing}
        >
          Skip →
        </button>
      </div>

      {/* Interim Celebration Modal */}
      {showCelebration && (
        <div className="celebration-modal">
          <div className="celebration-content">
            <img
              src="/assets/avatar/mascot_excited.png"
              alt="Excited mascot"
              className="celebration-mascot"
            />
            <h1>🎉 Excellent!</h1>
            <div className="celebration-word">{currentword}</div>
            <p>Word {currentword} completed!</p>
            <div className="celebration-progress">
              {completedGeneralWords.length}/{generalWords.length} Words Mastered ({progressPercentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Badge Celebration Modal */}
      <CelebrationModal
        badge={newUnlockedBadge}
        onClose={() => setNewUnlockedBadge(null)}
      />

      {/* Stage Complete Overlay with Badge */}
      {showStageComplete && (
        <div className="stage-complete-modal">
          <Confetti width={window.innerWidth} height={window.innerHeight} />
          <div className="stage-complete-content">
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Mascot with Glasses"
              className="badge-mascot mascot-bounce"
              style={{ width: '150px', marginBottom: '20px' }}
            />
            <h1 style={{ fontSize: '2.5rem', color: '#2D3748', marginBottom: '10px' }}>🎉 Stage Complete!</h1>
            <h2 style={{ fontSize: '1.5rem', color: '#DD6B20', marginBottom: '30px' }}>General Words Mastered!</h2>

            <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '20px', borderRadius: '15px', marginBottom: '30px', border: '2px solid #48BB78' }}>
              <p style={{ fontSize: '1.3rem', color: '#2F855A', margin: '5px 0', fontWeight: 'bold' }}>✨ New Avatar Style Unlocked!</p>
              <p style={{ fontSize: '1.1rem', color: '#4A5568' }}>Your mascot looks legendary!</p>
            </div>

            <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '20px', borderRadius: '15px', marginBottom: '30px' }}>
              <img src="/assets/badges/badge_wonderland_champ.png" alt="Vocabulary Legend Badge" className="badge-icon-img" style={{ width: '80px', height: '80px', marginBottom: '10px' }} />
              <p style={{ fontSize: '1.2rem', color: '#2D3748' }}>You received the <strong>Vocabulary Legend</strong> badge!</p>
            </div>

            <button
              className="btn-primary"
              style={{ fontSize: '1.3rem', padding: '15px 40px' }}
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

      {/* All GeneralWords Completed (fallback if stage complete doesn't trigger) */}
      {completedGeneralWords.length === generalWords.length && !isAdvancing && !showStageComplete && (
        <div className="completion-modal">
          <div className="completion-content">
            <h1>🌟 Congratulations!</h1>
            <h2>You've Completed All 40 General Words!</h2>
            <button
              className="btn-primary"
              onClick={() => navigate('/dashboard')}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralWordsLessonPage;



