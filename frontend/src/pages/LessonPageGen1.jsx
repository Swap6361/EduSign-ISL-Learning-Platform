import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedGen1 from '../components/CameraFeedGen1';
import ProgressBar from '../components/ProgressBar';
import predictionServiceGen1 from '../services/predictionServiceGen1';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';

const Gen1LessonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stage } = location.state || { stage: 'beginner' };

  // 24 Motion Words for General Words Stage 1
  const gen1Words = [
    'Afternoon', 'Born', 'Brush', 'Bye', 'Come', 'Cry', 'Go', 'Happy',
    'Hearing', 'Hello', 'Man', 'Morning', 'Name', 'Nice', 'Night', 'Please',
    'Sad', 'Separate', 'Sorry', 'Thankyou', 'Week', 'Welcome', 'Woman', 'Yes'
  ];
  const [currentwordIndex, setcurrentwordIndex] = useState(0);
  const [completedGen1, setcompletedGen1] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const predictionTimeoutRef = useRef(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [stabilityCount, setStabilityCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [stable, setStable] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [mascotMood, setMascotMood] = useState('neutral'); // neutral | excited | sad
  const [showStageComplete, setShowStageComplete] = useState(false);
  const [pendingStageComplete, setPendingStageComplete] = useState(false);
  const [newUnlockedBadge, setNewUnlockedBadge] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [stageStartTime, setStageStartTime] = useState(null);
  const [stageTimer, setStageTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const lastFeedbackTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const advanceToNextDayRef = useRef(null);
  const persistDayCompletionRef = useRef(null);
  const handleStageCompleteRef = useRef(null);
  const [cameraEnabled, setCameraEnabled] = useState(false); // Manual camera start

  const REQUIRED_STABILITY = 2;  // Reduced from 3 for faster completion
  const CONFIDENCE_THRESHOLD = 0.60;  // Lowered to 60% to match backend
  const currentword = gen1Words[currentwordIndex];

  // Load progress on mount and start timer
  useEffect(() => {
    const loadUserProgress = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const userProgress = await userProgressService.getProgress(user.uid);
        if (userProgress?.completedGen1) {
          setcompletedGen1(userProgress.completedGen1);
          // Find first incomplete word or start from beginning
          const firstIncomplete = gen1Words.findIndex(word => !userProgress.completedGen1.includes(word));
          if (firstIncomplete >= 0) {
            setcurrentwordIndex(firstIncomplete);
          }
        }
        // Resume timer if stage was in progress
        if (userProgress?.Gen1Time && userProgress.completedGen1?.length < 12) {
          setStageTimer(userProgress.Gen1Time);
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
        try {
          await userProgressService.updateStageTime(user.uid, 'Gen1', stageTimer);
        } catch (error) {
          console.warn('⚠️ [Gen1] Could not save time (Quota/Offline):', error);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [stageTimer]);


  // Quota Warning State
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (offlineMode) {
      const timer = setTimeout(() => setOfflineMode(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [offlineMode]);


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

    console.log('📊 [GEN1] Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentword, 'Index:', currentwordIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

    // Update current prediction display ALWAYS (prevents stuck display)
    setCurrentPrediction({ label, confidence: conf, stable: isStable });

    // CRITICAL: Don't process if we're already advancing
    if (isAdvancing) {
      console.log('⏸ [Gen1] Skipping prediction - already advancing');
      return;
    }

    // Check if already completed this word
    if (completedGen1.includes(currentword)) {
      console.log('⚠️ [Gen1] Word', currentword, 'already completed');
      return;
    }

    // Only accept stable predictions that match the current word (case-insensitive)
    console.log('🔍 [GEN1] Checking match:', label.toUpperCase(), '===', currentword.toUpperCase(), '?', label.toUpperCase() === currentword.toUpperCase());
    console.log('🔍 [GEN1] Confidence check:', conf, '>=', CONFIDENCE_THRESHOLD, '?', conf >= CONFIDENCE_THRESHOLD);
    console.log('🔍 [GEN1] Stable check:', isStable);

    if (label.toUpperCase() === currentword.toUpperCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
      console.log('✅ [GEN1] MATCH! Adding to history');
      setPredictionHistory((prev) => {
        const next = [...prev, label].slice(-REQUIRED_STABILITY);
        const matches = next.filter(x => x.toUpperCase() === currentword.toUpperCase()).length;

        setStabilityCount(matches);

        // word completed!
        if (matches >= REQUIRED_STABILITY) {
          // Double check not already completed and not advancing
          if (!completedGen1.includes(currentword) && !isAdvancing) {
            const newCompleted = [...completedGen1, currentword];
            setcompletedGen1(newCompleted);
            setMascotMood('excited');
            if (persistDayCompletionRef.current) {
              persistDayCompletionRef.current(currentword, true);
            }

            // Check if stage is complete (all 24 Gen1)
            if (newCompleted.length === gen1Words.length) {
              if (handleStageCompleteRef.current) {
                handleStageCompleteRef.current();
              }
            } else {
              // Auto-advance to next word
              if (advanceToNextDayRef.current) {
                // PASS the new completion list so advancement logic knows current word is done
                advanceToNextDayRef.current(newCompleted);
              } else {
                console.error('❌ ERROR: advanceToNextDayRef.current is NULL or undefined!');
              }
            }
          }
        }
        return next;
      });
    } else {
      // Reset stability if wrong word or low confidence
      if (label !== currentword) {
        setMascotMood('sad');
        if (persistDayCompletionRef.current) {
          persistDayCompletionRef.current(currentword, false);
        }
      }
      setPredictionHistory([]);
      setStabilityCount(0);
    }
  }, [currentword, currentwordIndex, completedGen1, isAdvancing, gen1Words.length]);

  const persistDayCompletion = useCallback(async (word, isCorrect) => {
    const user = authService.getCurrentUser();
    if (!user) {
      console.error('❌ [Gen1] No user found, cannot save completion');
      return;
    }

    console.log('💾 [Gen1] Saving word completion to Firebase:', word, 'isCorrect:', isCorrect);

    if (isCorrect) {
      // 1. Check for Local Badges (Immediate Feedback)
      const count = completedGen1.length + 1;
      let localBadge = null;
      if (count === 5) localBadge = { id: 'action_starter', name: 'Action Starter', icon: '/assets/badges/badge_motion_starter.png' };
      else if (count === 12) localBadge = { id: 'action_learner', name: 'Action Learner', icon: '/assets/badges/badge_action_learner.png' };

      if (localBadge) {
        console.log('🏅 [Local] Badge Unlocked:', localBadge.name);
        setNewUnlockedBadge(localBadge);
        setShowCelebration(true);
        setMascotMood('excited');
      }

      // 2. Persist to Backend
      try {
        const result = await userProgressService.completeWord(user.uid, 'Gen1', word);
        console.log('✅ [Gen1] word saved to Firebase:', word, 'Result:', result);

        // If backend returns OTHER badges (not the ones we just handled locally), show them too?
        // Usually local check covers it. We ignore backend badges for 5/12 to avoid double popups or missing ones.
        // But if there's a different badge, we might want it. For now, trust local for the main milestones.

        await userProgressService.setFeedback(user.uid, 'correct');
        await userProgressService.updateStreak(user.uid);

        await userProgressService.updatePerformance(user.uid, {
          noMistakeStreak: count,
          perfectStreak: count >= 3 ? 3 : count,
          happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
        });
      } catch (error) {
        console.error('❌ [Gen1] Error saving to Firebase:', error);
        if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota')) {
          setOfflineMode(true);
          console.warn('⚠️ [Gen1] Quota Exceeded - Progress saved locally.');
        }
      }
    } else {
      await userProgressService.setFeedback(user.uid, 'wrong');
      const userProgress = await userProgressService.getProgress(user.uid);
      await userProgressService.updatePerformance(user.uid, {
        practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
      });
    }
  }, [completedGen1.length]);

  // Handle stage complete (24 Words)
  const handleStageComplete = useCallback(() => {
    const user = authService.getCurrentUser();
    if (user) {
      // Attempt to save stage completion
      try {
        userProgressService.updateStageTime(user.uid, 'Gen1', stageTimer);
        userProgressService.completeStage(user.uid, 'Gen1', stageTimer);
      } catch (e) {
        console.warn('⚠️ [Gen1] Offline stage complete');
      }
    }

    // Explicitly set the Action Master badge for the final overlay
    setNewUnlockedBadge({
      id: 'action_master',
      name: 'Action Master',
      icon: '/assets/badges/badge_action_hero.png'
    });

    setPendingStageComplete(true);
    setShowCelebration(true);
    setMascotMood('excited');
    setShowStageComplete(true); // Trigger the specific stage complete overlay
  }, [stageTimer]);

  // Handle closing of celebration modal (Only used for Badge/Stage Complete now)
  const handleCelebrationClose = () => {
    setShowCelebration(false); // Close the modal if open

    if (newUnlockedBadge) {
      setNewUnlockedBadge(null); // Clear badge state
      // Resume advancement after badge is acknowledged
      if (currentwordIndex < gen1Words.length - 1) {
        setcurrentwordIndex(prev => prev + 1);
      }
      setMascotMood('neutral');
      setPredictionHistory([]);
      setStabilityCount(0);
      setCurrentPrediction(null);
      setIsAdvancing(false);
      return;
    }

    if (pendingStageComplete) {
      setShowStageComplete(true);
      setPendingStageComplete(false);
    }
  };

  // Auto-advance trigger
  const advanceToNextDay = useCallback((latestCompletedList) => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setShowCelebration(true); // Shows inline div
    setMascotMood('excited');

    setTimeout(() => {
      // If a badge is showing, DO NOT auto-advance. Let the user close the modal.
      setNewUnlockedBadge(prev => {
        if (prev) {
          setShowCelebration(false);
          return prev;
        }

        setShowCelebration(false);
        setMascotMood('neutral');
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);

        // ROBUST ADVANCEMENT LOGIC:
        // Find the first word that is NOT in the completed list.
        // This ensures we never skip words like "Born", "Brush", "Bye".
        // Use the latest list passed from handlePrediction if available, else state.
        const listToCheck = latestCompletedList || completedGen1;
        const nextIncompleteIndex = gen1Words.findIndex(word => !listToCheck.includes(word));

        console.log('🔄 [GEN1] Auto-Advancing... nextIncompleteIndex:', nextIncompleteIndex);

        if (nextIncompleteIndex !== -1) {
          setcurrentwordIndex(nextIncompleteIndex);
        } else {
          // Fallback if all complete (should match stage complete logic, but just in case)
          if (currentwordIndex < gen1Words.length - 1) {
            setcurrentwordIndex(prev => prev + 1);
          }
        }

        setIsAdvancing(false);
        return null;
      });
    }, 1000);
  }, [isAdvancing, currentwordIndex, gen1Words, completedGen1]);

  // Update refs when functions change
  useEffect(() => {
    advanceToNextDayRef.current = advanceToNextDay;
    persistDayCompletionRef.current = persistDayCompletion;
    handleStageCompleteRef.current = handleStageComplete;
  }, [advanceToNextDay, persistDayCompletion, handleStageComplete]);

  useEffect(() => {
    const handler = (result) => handlePrediction(result);
    predictionServiceGen1.onPrediction(handler);
    return () => {
      predictionServiceGen1.offPrediction(handler);
    };
  }, [currentword, currentwordIndex, completedGen1, isAdvancing, handlePrediction]);

  // Navigate to specific word (manual navigation)
  const goToDay = (index) => {
    if (isAdvancing) {
      return;
    }

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
    if (currentwordIndex < gen1Words.length - 1) {
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
  const progressPercentage = Math.round((completedGen1.length / gen1Words.length) * 100);

  return (
    <div className="lesson-page">
      {/* Header */}
      <div className="lesson-header">
        <button className="back-button" onClick={async () => {
          const user = authService.getCurrentUser();
          if (user && stageTimer > 0) {
            await userProgressService.updateStageTime(user.uid, 'Gen1', stageTimer);
          }
          navigate('/dashboard');
        }}>
          ← Back to Dashboard
        </button>
        <h2>🎨 Action Island - Learn Motion Words</h2>
        <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
          🔄 Reset
        </button>
      </div>

      {/* Offline/Quota Warning Banner */}
      {offlineMode && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#FFF3CD',
          color: '#856404',
          padding: '10px 20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 'bold'
        }}>
          <span>⚠️ Database Quota Exceeded</span>
          <span style={{ fontWeight: 'normal' }}>Progress saved locally but may not persist on refresh.</span>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="reset-confirm-modal">
          <div className="reset-confirm-content">
            <h3>⚠️ Reset Progress?</h3>
            <p>Are you sure you want to reset your Gen1 Island progress? This will remove all completed Gen1 and start from the beginning.</p>
            <div className="reset-buttons">
              <button className="reset-yes" onClick={async () => {
                console.log('🔄 [GEN1] Reset initiated...');
                const user = authService.getCurrentUser();

                // 1. Clear Local State Immediately (Visual Feedback)
                setcompletedGen1([]);
                setcurrentwordIndex(0);
                setStageTimer(0);
                setPredictionHistory([]);
                setStabilityCount(0);
                setCurrentPrediction(null);
                setMascotMood('neutral');

                // 2. Clear Database
                if (user) {
                  console.log('🔄 [GEN1] Clearing Backend Progress for', user.uid);
                  const result = await userProgressService.resetStage(user.uid, 'Gen1');
                  console.log('✅ [GEN1] Backend Reset Result:', result);

                  // Restart Timer
                  setStageStartTime(Date.now());
                  setIsTimerRunning(true);
                }

                setShowResetConfirm(false);

                // 3. Close ALL Overlays explicitly
                setShowCelebration(false);
                setShowStageComplete(false);
                setPendingStageComplete(false);
                setNewUnlockedBadge(null);

                console.log('✅ [GEN1] Reset Complete - All states cleared');
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
          completed={completedGen1.length}
          total={gen1Words.length}
          label="Your Progress"
        />
      </div>

      {/* word Navigator */}
      <div className="word-navigator">
        <h3>Choose a word</h3>
        <div className="azWords-scroll">
          {gen1Words.map((word, index) => (
            <button
              key={word}
              className={`word-btn ${index === currentwordIndex ? 'active' : ''} ${completedGen1.includes(word) ? 'completed' : ''
                }`}
              onClick={() => goToDay(index)}
              disabled={isAdvancing}
            >
              {word}
              {completedGen1.includes(word) && (
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
              <video
                key={currentword}
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => console.error(`❌ [Gen1] Video failed to load: ${currentword}`, e.currentTarget.error, e.currentTarget.src)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  background: '#000'
                }}
              >
                <source src={`/general-words/${encodeURIComponent(currentword)}%20-%20Trim.mp4`} type="video/mp4" />
                {/* Fallback for unencoded path just in case */}
                <source src={`/general-words/${currentword} - Trim.mp4`} type="video/mp4" />
              </video>
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
          {!cameraEnabled ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              color: 'white',
              padding: '40px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>📷</div>
              <h3 style={{ marginBottom: '10px' }}>Camera Ready</h3>
              <p style={{ marginBottom: '30px', opacity: 0.9 }}>Click below to start the webcam</p>
              <button
                onClick={() => setCameraEnabled(true)}
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  background: 'white',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                🎥 Start Camera
              </button>
            </div>
          ) : (
            <CameraFeedGen1
              currentword={currentword}
              onPrediction={handlePrediction}
              predictionService={predictionServiceGen1}
              useWebSocket={true}
              cameraEnabled={cameraEnabled}
            />
          )}
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
          disabled={currentwordIndex === gen1Words.length - 1 || isAdvancing}
        >
          Skip →
        </button>
      </div>

      {/* Celebration Modal (Inline for standard words) */}
      {showCelebration && !pendingStageComplete && !newUnlockedBadge && (
        <div className="celebration-modal">
          <div className="celebration-content" style={{ maxWidth: '400px', padding: '15px' }}>
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Mascot with Hat and Glasses"
              className="celebration-mascot"
              style={{ width: '120px', height: '120px', margin: '0 auto 10px', display: 'block', position: 'relative', left: '60px' }}
            />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🎉 Excellent!</h1>
            <div className="celebration-word" style={{ fontSize: '2.5rem', margin: '5px 0' }}>{currentword}</div>
            <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Word {currentword} completed!</p>
            <div className="celebration-progress" style={{ fontSize: '0.8rem' }}>
              {completedGen1.length}/{gen1Words.length} Gen1 Mastered ({progressPercentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Badge Celebration Modal (For Stage Complete OR Interim Badges) */}
      {(pendingStageComplete || newUnlockedBadge) && (
        <CelebrationModal
          badge={newUnlockedBadge || {
            id: 'word_completion',
            name: currentword,
            icon: '/assets/avatar/mascot_excited.png'
          }}
          onClose={handleCelebrationClose}
        />
      )}

      {/* All Gen1 Words Completed (fallback) */}
      {completedGen1.length === gen1Words.length && !isAdvancing && !showStageComplete && (
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
            <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>Action Island Mastered!</h2>

            <div className="stats-summary" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
              <div className="stat-box" style={{ background: '#F7FAFC', padding: '10px', borderRadius: '10px', minWidth: '80px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2D3748' }}>{gen1Words.length}</div>
                <div style={{ fontSize: '0.8rem', color: '#718096' }}>Words</div>
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

      {/* Stage Complete Overlay with Badge (Immediate) */}
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
            <h1 style={{ fontSize: '2rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Stage Complete!</h1>
            <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>Gen1 Island Mastered!</h2>

            <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
              <div className="badge-icon" style={{ fontSize: '3rem', marginBottom: '5px' }}>🏆</div>
              <p style={{ fontSize: '0.9rem', color: '#2D3748', margin: '0' }}>You received the <strong>Gen1 Master</strong> badge!</p>
            </div>

            <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '2px solid #48BB78' }}>
              <p style={{ fontSize: '1rem', color: '#2F855A', margin: '2px 0', fontWeight: 'bold' }}>🎓 Intermediate Unlocked!</p>
              <p style={{ fontSize: '0.8rem', color: '#4A5568', margin: '0' }}>Keep learning!</p>
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

export default Gen1LessonPage;





