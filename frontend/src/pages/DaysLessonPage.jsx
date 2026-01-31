import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedDays from '../components/CameraFeedDays';
import ProgressBar from '../components/ProgressBar';
import predictionServiceDays from '../services/predictionServiceDays';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const DaysLessonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stage } = location.state || { stage: 'beginner' };

  // Full days including J (26 Days)
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [completedDays, setCompletedDays] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [stabilityCount, setStabilityCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [stable, setStable] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [mascotMood, setMascotMood] = useState('neutral'); // neutral | excited | sad
  const [pendingStageComplete, setPendingStageComplete] = useState(false);
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
  const currentDay = days[currentDayIndex];

  // Load progress on mount and start timer
  useEffect(() => {
    const loadUserProgress = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const userProgress = await userProgressService.getProgress(user.uid);
        if (userProgress?.completedDays) {
          setCompletedDays(userProgress.completedDays);
          // Find first incomplete Day or start from beginning
          const firstIncomplete = days.findIndex(day => !userProgress.completedDays.includes(day));
          if (firstIncomplete >= 0) {
            setCurrentDayIndex(firstIncomplete);
          }
        }
        // Resume timer if stage was in progress
        if (userProgress?.daysTime && userProgress.completedDays?.length < 7) {
          setStageTimer(userProgress.daysTime);
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
        await userProgressService.updateStageTime(user.uid, 'days', stageTimer);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [stageTimer]);

  const DayTips = {
    'Monday': ['Circle motion', 'M handshape', 'Rub in circle'],
    'Tuesday': ['Circle motion', 'T handshape', 'Rub in circle'],
    'Wednesday': ['Circle motion', 'W handshape', 'Rub in circle'],
    'Thursday': ['H handshape', 'Move down', 'Or circle motion'],
    'Friday': ['Circle motion', 'F handshape', 'Rub in circle'],
    'Saturday': ['Circle motion', 'S handshape', 'Rub in circle'],
    'Sunday': ['Open hands', 'Move down', 'Like "Wonderful"']
  };

  // Handle prediction from camera
  const handlePrediction = useCallback(async (result) => {
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

    const label = String(result.day || result.label).toUpperCase();
    const conf = Number(result.confidence || 0);
    const isStable = result.stable !== false; // Default to true if not specified

    console.log('📊 [DAYS] Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentDay, 'Index:', currentDayIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

    // Update current prediction display
    setCurrentPrediction({ label, confidence: conf, stable: isStable });

    // CRITICAL: Don't process if we're already advancing
    if (isAdvancing) {
      console.log('⏸ [DAYS] Skipping prediction - already advancing');
      return;
    }

    // Check if already completed this Day
    if (completedDays.includes(currentDay)) {
      console.log('⚠️ [DAYS] Day', currentDay, 'already completed');
      return;
    }

    // Only accept stable predictions that match the current Day (case-insensitive)
    if (label.toUpperCase() === currentDay.toUpperCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
      console.log('✅ [DAYS] CONDITION MET: Adding to stability counter');
      setPredictionHistory((prev) => {
        console.log('📝 Previous history:', prev);
        const next = [...prev, label].slice(-REQUIRED_STABILITY);
        const matches = next.filter(x => x.toUpperCase() === currentDay.toUpperCase()).length;

        console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
        console.log('📊 State check:', {
          matches,
          required: REQUIRED_STABILITY,
          meetsThreshold: matches >= REQUIRED_STABILITY,
          currentDay,
          completedDays,
          alreadyCompleted: completedDays.includes(currentDay),
          isAdvancing
        });
        setStabilityCount(matches);

        // Day completed!
        if (matches >= REQUIRED_STABILITY) {
          console.log('🎯 STABILITY REACHED! Day:', currentDay, 'Completed:', completedDays, 'isAdvancing:', isAdvancing);

          // Double check not already completed and not advancing
          if (!completedDays.includes(currentDay) && !isAdvancing) {
            console.log('✅ COMPLETING Day:', currentDay);

            const newCompleted = [...completedDays, currentDay];
            setCompletedDays(newCompleted);
            setMascotMood('excited');

            // Handle sequence: Persistence -> Badge -> Stage Complete
            const runCompletionSequence = async () => {
              let badgeEarned = false;
              if (persistDayCompletionRef.current) {
                // Await persistence to check for badges
                badgeEarned = await persistDayCompletionRef.current(currentDay, true);
              }

              // Check if stage is complete (all 26 Days)
              if (newCompleted.length === days.length) {
                console.log('🏆 ALL DayS COMPLETE!');

                // If badge was earned, wait for it to close
                if (badgeEarned) {
                  console.log('⏳ Badge earned, pending stage complete...');
                  setPendingStageComplete(true);
                } else {
                  if (handleStageCompleteRef.current) {
                    handleStageCompleteRef.current();
                  }
                }
              } else {
                // Auto-advance to next Day
                console.log('➡️ Triggering advancement...');
                if (advanceToNextDayRef.current) {
                  advanceToNextDayRef.current();
                }
              }
            };

            runCompletionSequence();

          } else {
            console.log('⚠️ Blocked - already completed or advancing', {
              alreadyCompleted: completedDays.includes(currentDay),
              isAdvancing
            });
          }
        }
        return next;
      });
    } else {
      // Reset stability if wrong Day or low confidence
      console.log('❌ CONDITION NOT MET - Resetting stability', {
        labelMatches: label === currentDay,
        label,
        currentDay,
        confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
        confidence: conf,
        threshold: CONFIDENCE_THRESHOLD,
        isStable
      });

      if (label !== currentDay) {
        console.log('❌ Wrong Day detected:', label, '(expected:', currentDay + ')');
        setMascotMood('sad');
        if (persistDayCompletionRef.current) {
          persistDayCompletionRef.current(currentDay, false);
        }
      } else if (!isStable) {
        console.log('⏳ Waiting for stable prediction...');
      } else {
        console.log('⚠️ Low confidence:', (conf * 100).toFixed(0) + '% (need 65%+)');
      }
      setPredictionHistory([]);
      setStabilityCount(0);
    }
  }, [currentDay, currentDayIndex, completedDays, isAdvancing, days.length]);

  const persistDayCompletion = useCallback(async (day, isCorrect) => {
    const user = authService.getCurrentUser();
    if (!user) {
      console.error('❌ [DAYS] No user found, cannot save completion');
      return false;
    }

    console.log('💾 [DAYS] Saving day completion to Firebase:', day, 'isCorrect:', isCorrect);

    if (isCorrect) {
      try {
        const result = await userProgressService.completeDay(user.uid, day);
        console.log('✅ [DAYS] Day saved to Firebase:', day, 'Result:', result);
        let hasNewBadge = false;

        if (result.newBadges && result.newBadges.length > 0) {
          const allBadges = getAllBadges();
          const badge = allBadges.find(b => b.name === result.newBadges[0]);
          if (badge) {
            setNewUnlockedBadge(badge);
            hasNewBadge = true;
          }
        }

        await userProgressService.setFeedback(user.uid, 'correct');
        await userProgressService.updateStreak(user.uid);

        // Track performance metrics
        const currentStreak = completedDays.length + 1;
        await userProgressService.updatePerformance(user.uid, {
          noMistakeStreak: currentStreak,
          perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
          happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
        });
        return hasNewBadge;
      } catch (error) {
        console.error('❌ [DAYS] Error saving to Firebase:', error);
        return false;
      }
    } else {
      await userProgressService.setFeedback(user.uid, 'wrong');
      const userProgress = await userProgressService.getProgress(user.uid);
      await userProgressService.updatePerformance(user.uid, {
        practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
      });
      return false;
    }
  }, [completedDays.length]);

  // Handle stage complete
  const handleStageComplete = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (user) {
      // Stop timer and save final time
      setIsTimerRunning(false);
      await userProgressService.updateStageTime(user.uid, 'days', stageTimer);

      // Award badge and unlock next stage
      await userProgressService.completeStage(user.uid, 'days', stageTimer);
    }

    setShowStageComplete(true);
    setShowCelebration(true);
    setMascotMood('excited');

    // Big celebration
    // confetti already in component
  }, [stageTimer]);

  // Handle closing of celebration modal (Resumes advancement)
  const handleCelebrationClose = () => {
    if (newUnlockedBadge) {
      setNewUnlockedBadge(null);
      // Resume advancement logic
      setShowCelebration(false);
      setMascotMood('neutral');
      setPredictionHistory([]);
      setStabilityCount(0);
      setCurrentPrediction(null);

      if (currentDayIndex < days.length - 1) {
        const nextIndex = currentDayIndex + 1;
        setCurrentDayIndex(nextIndex);
      }
      setIsAdvancing(false);
    }
  };

  // FIX: Use ref for safe access
  const completedDaysRef = useRef(completedDays);
  useEffect(() => {
    completedDaysRef.current = completedDays;
  }, [completedDays]);

  // Auto-advance to next day
  const advanceToNextDay = useCallback(() => {
    if (isAdvancing) {
      console.log('⏸ [DAYS] Already advancing, skipping');
      return;
    }

    console.log('🎯 [DAYS] Starting advance from day', currentDay, 'index', currentDayIndex);
    setIsAdvancing(true);
    setShowCelebration(true);
    setMascotMood('excited');

    // Immediate state reset to allow next day
    setTimeout(() => {
      // Check if badge is blocking
      setNewUnlockedBadge(prev => {
        if (prev) {
          console.log('🏅 [days] Badge detected! Hiding inline celebration.');
          setShowCelebration(false);
          return prev;
        }

        setShowCelebration(false);
        const currentCompleted = completedDaysRef.current; // Access fresh state

        // Find next incomplete, starting from current + 1
        let nextIndex = -1;
        for (let i = currentDayIndex + 1; i < days.length; i++) {
          if (!currentCompleted.includes(days[i])) {
            nextIndex = i;
            break;
          }
        }

        if (nextIndex !== -1) {
          console.log(`⏩ Jumping to ${days[nextIndex]}`);
          setCurrentDayIndex(nextIndex);
        } else {
          // If end reached, look from beginning
          const missedIndex = days.findIndex(d => !currentCompleted.includes(d));
          if (missedIndex !== -1) {
            console.log(`↺ Looping to missed day: ${days[missedIndex]}`);
            setCurrentDayIndex(missedIndex);
          } else {
            console.log('🏆 All days done. Stage Complete!');
            // Only trigger if not already showing
            if (!showStageComplete) {
              if (handleStageCompleteRef.current) handleStageCompleteRef.current();
            }
          }
        }

        setMascotMood('neutral');
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);

        console.log('✅ [days] Advance complete, resetting isAdvancing to false');
        setIsAdvancing(false);
        return null;
      });
    }, 1000); // 1 second celebration
  }, [isAdvancing, currentDay, currentDayIndex, days.length, showStageComplete]);

  // Update refs when functions change
  useEffect(() => {
    advanceToNextDayRef.current = advanceToNextDay;
    persistDayCompletionRef.current = persistDayCompletion;
    handleStageCompleteRef.current = handleStageComplete;
  }, [advanceToNextDay, persistDayCompletion, handleStageComplete]);

  useEffect(() => {
    const handler = (result) => handlePrediction(result);
    predictionServiceDays.onPrediction(handler);
    console.log('🔄 Re-registered prediction handler for Day:', currentDay);
    return () => {
      predictionServiceDays.offPrediction(handler);
    };
  }, [currentDay, currentDayIndex, completedDays, isAdvancing, handlePrediction]);

  // Navigate to specific Day (manual navigation)
  const goToDay = (index) => {
    if (isAdvancing) {
      console.log('⏸ Cannot navigate while advancing');
      return;
    }

    console.log('📍 Manual navigation to index', index, 'Day', days[index]);

    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    setCurrentDayIndex(index);
  };

  // Skip handler
  const skipDay = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentDayIndex < days.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  // Previous Day handler
  const prevDay = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.round((completedDays.length / days.length) * 100);

  return (
    <div className="lesson-page">
      {/* Header */}
      <div className="lesson-header">
        <button className="back-button" onClick={async () => {
          const user = authService.getCurrentUser();
          if (user && stageTimer > 0) {
            await userProgressService.updateStageTime(user.uid, 'days', stageTimer);
          }
          navigate('/dashboard');
        }}>
          ← Back to Dashboard
        </button>
        <h2>🏝 Days Island - Learn Weekdays</h2>
        <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
          🔄 Reset
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="reset-confirm-modal">
          <div className="reset-confirm-content">
            <h3>⚠️ Reset Progress?</h3>
            <p>Are you sure you want to reset your Days Island progress? This will remove all completed Days and start from the beginning.</p>
            <div className="reset-buttons">
              <button className="reset-yes" onClick={async () => {
                const user = authService.getCurrentUser();
                if (user) {
                  await userProgressService.resetStage(user.uid, 'days');
                  setCompletedDays([]);
                  setCurrentDayIndex(0);
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
          completed={completedDays.length}
          total={days.length}
          label="Your Progress"
        />
      </div>

      {/* Day Navigator */}
      <div className="word-navigator">
        <h3>Choose a Day</h3>
        <div className="azWords-scroll days-mode">
          {days.map((Day, index) => (
            <button
              key={Day}
              className={`word-btn ${index === currentDayIndex ? 'active' : ''} ${completedDays.includes(Day) ? 'completed' : ''
                }`}
              onClick={() => goToDay(index)}
              disabled={isAdvancing}
            >
              {Day}
              {completedDays.includes(Day) && (
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
              <img
                key={currentDay}
                src={`/days/${currentDay}.jpeg`}
                alt={`ASL sign for ${currentDay}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px'
                }}
              />
            </div>
            <div className="current-Day-display">
              <h1>{currentDay}</h1>
              <p>Day {currentDay}</p>
              {currentDay === 'J' && (
                <p className="motion-hint">⚡ Motion Required</p>
              )}
            </div>
          </div>

          <div className="tips-card">
            <h4>💡 Quick Tips</h4>
            <ul>
              {(DayTips[currentDay] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                <li key={i}>✓ {tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Center Panel - Camera */}
        <div className="camera-panel">
          <CameraFeedDays
            currentDay={currentDay}
            onPrediction={handlePrediction}
            useWebSocket={true}
          />
        </div>

        {/* Right Panel - Feedback */}
        <div className="feedback-panel">
          <h3>🎯 Recognition</h3>

          <div className="prediction-display">
            {currentPrediction ? (
              <>
                <div className={`predicted-Day ${currentPrediction.label === currentDay ? 'correct' : 'incorrect'
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

                {currentPrediction.label === currentDay && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                  <div className="feedback-message success">
                    ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                  </div>
                ) : currentPrediction.label === currentDay && currentPrediction.stable === false ? (
                  <div className="feedback-message hint">
                    ⏳ Good! Hold steady for recognition...
                  </div>
                ) : currentPrediction.label === currentDay ? (
                  <div className="feedback-message hint">
                    📊 Good! Hold steadier for higher confidence
                  </div>
                ) : (
                  <div className="feedback-message hint">
                    Try to make Day {currentDay}
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
          disabled={currentDayIndex === 0 || isAdvancing}
        >
          ← Previous
        </button>
        <button className="control-btn pause">⏸ Pause</button>
        <button
          className="control-btn skip"
          onClick={skipDay}
          disabled={currentDayIndex === days.length - 1 || isAdvancing}
        >
          Skip →
        </button>
      </div>

      {/* Celebration Modal */}
      {showCelebration && (
        <div className="celebration-modal">
          <div className="celebration-content" style={{ maxWidth: '400px', padding: '15px' }}>
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Mascot with Hat and Glasses"
              className="celebration-mascot"
              style={{ width: '120px', height: '120px', margin: '0 auto 10px', display: 'block', position: 'relative', left: '60px' }}
            />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🎉 Excellent!</h1>
            <div className="celebration-word" style={{ fontSize: '2.5rem', margin: '5px 0' }}>{days[currentDayIndex]}</div>
            <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Day {days[currentDayIndex]} completed!</p>
            <div className="celebration-progress" style={{ fontSize: '0.8rem' }}>
              {completedDays.length}/{days.length} Days Mastered ({progressPercentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Badge Celebration Modal */}
      <CelebrationModal
        badge={newUnlockedBadge}
        onClose={handleCelebrationClose}
      />

      {/* All Days Completed (fallback) */}
      {completedDays.length === days.length && !isAdvancing && !showStageComplete && (
        <div className="stage-complete-modal">
          <Confetti width={window.innerWidth} height={window.innerHeight} />
          <div className="stage-complete-content" style={{ padding: '20px' }}>
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Mascot with Hat and Glasses"
              className="badge-mascot mascot-bounce"
              style={{ width: '90px', marginBottom: '5px' }}
            />
            <h1 style={{ fontSize: '2rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Congratulations!</h1>
            <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>All 7 Days Mastered!</h2>

            <div className="stats-summary" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
              <div className="stat-box" style={{ background: '#F7FAFC', padding: '10px', borderRadius: '10px', minWidth: '80px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2D3748' }}>{days.length}</div>
                <div style={{ fontSize: '0.8rem', color: '#718096' }}>Days</div>
              </div>
              <div className="stat-box" style={{ background: '#F7FAFC', padding: '10px', borderRadius: '10px', minWidth: '80px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#48BB78' }}>100%</div>
                <div style={{ fontSize: '0.8rem', color: '#718096' }}>Complete</div>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ fontSize: '1.1rem', padding: '10px 30px', background: '#FF8C42', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 140, 66, 0.4)' }}
              onClick={() => navigate('/dashboard')}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Stage Complete Overlay with Badge */}
      {showStageComplete && (
        <div className="stage-complete-modal">
          <div className="stage-complete-content" style={{ padding: '20px' }}>
            <img src="/assets/avatar/mascot_hat_glasses.png" alt="Mascot with Hat and Glasses" className="badge-mascot" style={{ width: '90px', marginBottom: '5px' }} />
            <h1 style={{ fontSize: '2rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Stage Complete!</h1>
            <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>Days of Week Mastered!</h2>

            <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
              <div className="badge-icon" style={{ fontSize: '3rem', marginBottom: '5px' }}>📅</div>
              <p style={{ fontSize: '0.9rem', color: '#2D3748', margin: '0' }}>You received the <strong>Days Master</strong> badge!</p>
            </div>

            <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '2px solid #48BB78' }}>
              <p style={{ fontSize: '1rem', color: '#2F855A', margin: '2px 0', fontWeight: 'bold' }}>🎩 Hat avatar unlocked!</p>
              <p style={{ fontSize: '0.8rem', color: '#4A5568', margin: '0' }}>🌴 Word Jungle is now open!</p>
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

export default DaysLessonPage;
