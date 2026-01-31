import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedGen2 from '../components/CameraFeedGen2';
import ProgressBar from '../components/ProgressBar';
import predictionServiceGen2 from '../services/predictionServiceGen2';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const Gen2LessonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stage } = location.state || { stage: 'intermediate' };

  // 16 Static Words for General Words Stage 2
  const gen2Words = [
    'Bad', 'Drink', 'Food', 'Good', 'Home', 'I,Me', 'Like', 'Love',
    'My', 'Namaste', 'Sleep', 'Teacher', 'Today', 'Water', 'You', 'Your'
  ];
  const [currentwordIndex, setCurrentwordIndex] = useState(0);
  const [completedGen2, setCompletedGen2] = useState([]);
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
  const [newUnlockedBadge, setNewUnlockedBadge] = useState(null);
  const [goldenShoesUnlocked, setGoldenShoesUnlocked] = useState(false);

  // Map tricky words to their filename
  const getWordImage = (word) => {
    if (word === 'I,Me') return '/words/Me,I.jpg'; // Handle special case
    return `/words/${word}.jpg`;
  };
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [stageStartTime, setStageStartTime] = useState(null);
  const [stageTimer, setStageTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const lastFeedbackTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const advanceToNextwordRef = useRef(null);
  const persistwordCompletionRef = useRef(null);
  const handleStageCompleteRef = useRef(null);

  const REQUIRED_STABILITY = 2;  // Need 2 consecutive correct predictions
  const CONFIDENCE_THRESHOLD = 0.60;  // 60% confidence minimum
  const currentword = gen2Words[currentwordIndex];

  // Load progress on mount and start timer
  useEffect(() => {
    const loadUserProgress = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const userProgress = await userProgressService.getProgress(user.uid);
        if (userProgress?.completedGen2) {
          setCompletedGen2(userProgress.completedGen2);
          // Find first incomplete word or start from beginning
          const firstIncomplete = gen2Words.findIndex(word => !userProgress.completedGen2.includes(word));
          if (firstIncomplete >= 0) {
            setCurrentwordIndex(firstIncomplete);
          }
        }
        // Resume timer if stage was in progress
        if (userProgress?.Gen2Time && userProgress.completedGen2?.length < 16) {
          setStageTimer(userProgress.Gen2Time);
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
        await userProgressService.updateStageTime(user.uid, 'Gen2', stageTimer);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [stageTimer]);

  const wordTips = {
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
    if (!result?.success || !result?.word) { // Use 'word' field for Gen2 predictions
      // Reset on failed prediction
      setPredictionHistory([]);
      setStabilityCount(0);
      setMascotMood('neutral');
      return;
    }

    // Keep raw label; compare case-insensitively
    const predictedWord = String(result.word); // Use 'word' field
    const conf = Number(result.confidence || 0);
    const isStable = result.stable !== false; // Default to true if not specified


    console.log('📊 Prediction:', predictedWord, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentword, 'Index:', currentwordIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);
    console.log('🔍 Match check:', {
      rawPrediction: predictedWord,
      rawTarget: currentword,
      predictedLower: predictedWord.toLowerCase(),
      targetLower: currentword.toLowerCase(),
      MATCHES: predictedWord.toLowerCase() === currentword.toLowerCase(),
      confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
      conf: conf,
      threshold: CONFIDENCE_THRESHOLD,
      isStable,
      isAdvancing,
      alreadyCompleted: completedGen2.includes(currentword)
    });

    // Update current prediction display
    setCurrentPrediction({ label: predictedWord, confidence: conf, stable: isStable }); // Use 'label' for display consistency

    // CRITICAL: Don't process if we're already advancing
    if (isAdvancing) {
      console.log('⏸ Skipping prediction - already advancing');
      return;
    }

    // Check if already completed this word
    if (completedGen2.includes(currentword)) {
      console.log('⚠️ word', currentword, 'already in completed words:', completedGen2);
      return;
    }
    console.log('✅ [Gen2] Word NOT yet completed, can proceed:', currentword);

    // Only accept stable predictions that match the current word
    if (predictedWord.toLowerCase() === currentword.toLowerCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
      console.log('✅ CONDITION MET: Adding to stability counter');
      setPredictionHistory((prev) => {
        console.log('📝 Previous history:', prev);
        const next = [...prev, predictedWord].slice(-REQUIRED_STABILITY);
        const matches = next.filter(x => x.toLowerCase() === currentword.toLowerCase()).length;

        console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
        console.log('📊 State check:', {
          matches,
          required: REQUIRED_STABILITY,
          meetsThreshold: matches >= REQUIRED_STABILITY,
          currentword,
          completedGen2,
          alreadyCompleted: completedGen2.includes(currentword),
          isAdvancing
        });
        setStabilityCount(matches);

        // word completed!
        if (matches >= REQUIRED_STABILITY) {
          console.log('🎯 STABILITY REACHED! word:', currentword, 'Completed:', completedGen2, 'isAdvancing:', isAdvancing);

          // Double check not already completed and not advancing
          if (!completedGen2.includes(currentword) && !isAdvancing) {
            console.log('✅ COMPLETING word:', currentword);
            console.log('🚀 About to call advanceToNextwordRef.current');
            console.log('🔍 Ref status:', {
              refExists: !!advanceToNextwordRef.current,
              refType: typeof advanceToNextwordRef.current
            });

            const newCompleted = [...completedGen2, currentword];
            setCompletedGen2(newCompleted);
            setMascotMood('excited');
            if (persistwordCompletionRef.current) {
              persistwordCompletionRef.current(currentword, true);
            }

            // Check if stage is complete (all 16 words)
            if (newCompleted.length === gen2Words.length) {
              console.log('🏆 ALL wordS COMPLETE!');
              if (handleStageCompleteRef.current) {
                handleStageCompleteRef.current();
              }
            } else {
              // Auto-advance to next word
              console.log('➡️ Triggering advancement...');
              if (advanceToNextwordRef.current) {
                console.log('✅ Calling advanceToNextwordRef.current()');
                advanceToNextwordRef.current();
              } else {
                console.error('❌ ERROR: advanceToNextwordRef.current is NULL or undefined!');
              }
            }
          } else {
            console.log('⚠️ Blocked - already completed or advancing', {
              alreadyCompleted: completedGen2.includes(currentword),
              isAdvancing
            });
          }
        }
        return next;
      });
    } else {
      // Reset stability if wrong word or low confidence
      console.log('❌ CONDITION NOT MET - Resetting stability', {
        predictedWordMatches: predictedWord.toLowerCase() === currentword.toLowerCase(),
        predictedWord,
        currentword,
        confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
        confidence: conf,
        threshold: CONFIDENCE_THRESHOLD,
        isStable
      });

      // Update display even if wrong!
      setCurrentPrediction({ label: predictedWord, confidence: conf, stable: isStable }); // Ensure feedback shows

      if (predictedWord.toLowerCase() !== currentword.toLowerCase()) {
        console.log('❌ Wrong word detected:', predictedWord, '(expected:', currentword + ')');
        setMascotMood('sad');
        if (persistwordCompletionRef.current) {
          persistwordCompletionRef.current(currentword, false);
        }
      } else if (!isStable) {
        console.log('⏳ Waiting for stable prediction...');
      } else {
        console.log('⚠️ Low confidence:', (conf * 100).toFixed(0) + '% (need 60%+)');
      }
      setPredictionHistory([]);
      setStabilityCount(0);
    }
  }, [currentword, currentwordIndex, completedGen2, isAdvancing, gen2Words.length]);

  // Handle stage complete
  const handleStageComplete = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (user) {
      // Offline-safe stage completion
      try {
        userProgressService.updateStageTime(user.uid, 'Gen2', stageTimer);
        userProgressService.completeStage(user.uid, 'Gen2', stageTimer);

        // Check for Word Wonderland completion (Golden Shoes)
        const progress = await userProgressService.getProgress(user.uid);
        if (userProgressService.isWordWonderlandComplete(progress)) {
          console.log('👟 Word Wonderland Complete! Golden Shoes Unlocked!');
          setGoldenShoesUnlocked(true);
        }
      } catch (e) {
        console.warn('⚠️ [Gen2] Offline stage complete');
      }
    }

    // Explicitly set the Idea Master badge for the final overlay
    setNewUnlockedBadge({
      id: 'idea_master',
      name: 'Idea Master',
      icon: '/assets/badges/badge_idea_master.png'
    });

    setPendingStageComplete(true);
    setShowCelebration(true);
    setMascotMood('excited');
    setShowStageComplete(true); // Trigger the specific stage complete overlay
    setIsAdvancing(true); // Stop further detections
  }, [stageTimer]);

  const persistwordCompletion = useCallback(async (word, isCorrect) => {
    console.log('� [Gen2 PERSIST] Called:', { word, isCorrect });

    if (!isCorrect) {
      const now = Date.now();
      if (now - lastFeedbackTimeRef.current < 800) {
        return;
      }
      lastFeedbackTimeRef.current = now;
    }

    const user = authService.getCurrentUser();
    if (!user) return; // Should not happen in protected route usually

    if (isCorrect) {
      // 1. Check for Local Badges (Immediate Feedback)
      const count = completedGen2.length + 1;
      let localBadge = null;
      if (count === 5) localBadge = { id: 'idea_starter', name: 'Idea Starter', icon: '/assets/badges/badge_idea_starter.png' };
      else if (count === 10) localBadge = { id: 'idea_builder', name: 'Idea Builder', icon: '/assets/badges/badge_idea_builder.png' };

      if (localBadge) {
        console.log('🏅 [Local] Badge Unlocked:', localBadge.name);
        setNewUnlockedBadge(localBadge);
        setShowCelebration(true);
        setMascotMood('excited');
      }

      // 2. Persist to Backend
      try {
        const result = await userProgressService.completeWord(user.uid, 'Gen2', word);
        console.log('✅ [Gen2 PERSIST] Saved:', word);

        await userProgressService.setFeedback(user.uid, 'correct');
        await userProgressService.updateStreak(user.uid);

        const currentStreak = completedGen2.length + 1;
        await userProgressService.updatePerformance(user.uid, {
          noMistakeStreak: currentStreak,
          perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
          happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
        });

        // Track first 5 words time
        if (currentStreak === 5) { // Optimization: don't double fetch unless needed
          userProgressService.updatePerformance(user.uid, { firstFiveTime: stageTimer });
        }
      } catch (error) {
        console.error('🚨 [Gen2] Error saving:', error);
        // Quota checking handled inside service now mostly, but just in case:
        if (error?.code === 'resource-exhausted') {
          console.warn('⚠️ [Gen2] Quota Exceeded - Progress saved locally.');
        }
      }
    } else {
      try {
        await userProgressService.setFeedback(user.uid, 'wrong');
        const userProgress = await userProgressService.getProgress(user.uid);
        await userProgressService.updatePerformance(user.uid, {
          practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
        });
      } catch (e) { console.warn('Ignore error on wrong feedback'); }
    }
  }, [completedGen2.length, stageTimer]);

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

      if (currentwordIndex < gen2Words.length - 1) {
        const nextIndex = currentwordIndex + 1;
        setCurrentwordIndex(nextIndex);
      }
      setIsAdvancing(false);
    }
  };

  // Auto-advance to next word
  const advanceToNextword = useCallback(() => {
    if (isAdvancing) {
      console.log('⏸ Already advancing, skipping');
      return;
    }

    console.log('🎯 Starting advance from word', currentword, 'index', currentwordIndex);
    setIsAdvancing(true);
    setShowCelebration(true);
    setMascotMood('excited');

    // Immediate state reset to allow next word
    setTimeout(() => {
      // Check if badge is blocking
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

        if (currentwordIndex < gen2Words.length - 1) {
          const nextIndex = currentwordIndex + 1;
          const nextword = gen2Words[nextIndex];
          console.log('➡️ Advancing to index', nextIndex, 'word', nextword);
          setCurrentwordIndex(nextIndex);
        } else {
          console.log('🏆 Completed all words!');
        }

        console.log('✅ Advance complete, resetting isAdvancing to false');
        setIsAdvancing(false);
        return null;
      });
    }, 800); // Faster progression - 0.8 seconds
  }, [isAdvancing, currentword, currentwordIndex, gen2Words]);

  // Update refs when functions change
  useEffect(() => {
    advanceToNextwordRef.current = advanceToNextword;
    persistwordCompletionRef.current = persistwordCompletion;
    handleStageCompleteRef.current = handleStageComplete;
  }, [advanceToNextword, persistwordCompletion, handleStageComplete]);

  useEffect(() => {
    const handler = (result) => handlePrediction(result);
    predictionServiceGen2.onPrediction(handler);
    console.log('🔄 Re-registered prediction handler for word:', currentword);
    return () => {
      predictionServiceGen2.offPrediction(handler);
    };
  }, [currentword, currentwordIndex, completedGen2, isAdvancing, handlePrediction]);

  // Navigate to specific word (manual navigation)
  const goToword = (index) => {
    if (isAdvancing) {
      console.log('⏸ Cannot navigate while advancing');
      return;
    }

    console.log('📍 Manual navigation to index', index, 'word', gen2Words[index]);

    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    setCurrentwordIndex(index);
  };

  // Skip handler
  const skipword = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentwordIndex < gen2Words.length - 1) {
      setCurrentwordIndex(currentwordIndex + 1);
    }
  };

  // Previous word handler
  const prevword = () => {
    if (isAdvancing) return;
    setPredictionHistory([]);
    setStabilityCount(0);
    setCurrentPrediction(null);
    if (currentwordIndex > 0) {
      setCurrentwordIndex(currentwordIndex - 1);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.round((completedGen2.length / gen2Words.length) * 100);

  return (
    <div className="lesson-page">
      {/* Header */}
      <div className="lesson-header">
        <button className="back-button" onClick={async () => {
          try {
            const user = authService.getCurrentUser();
            if (user && stageTimer > 0) {
              // Non-blocking update attempt
              await userProgressService.updateStageTime(user.uid, 'Gen2', stageTimer).catch(e => console.warn('Nav-save failed', e));
            }
          } catch (e) {
            console.error("Back nav error", e);
          } finally {
            navigate('/dashboard');
          }
        }}>
          ← Back to Dashboard
        </button>
        <h2>🎨 Idea Island - Learn Static Words</h2>
        <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
          🔄 Reset
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="reset-confirm-modal">
          <div className="reset-confirm-content">
            <h3>⚠️ Reset Progress?</h3>
            <p>Are you sure you want to reset your Gen2 Island progress? This will remove all completed words and start from the beginning.</p>
            <div className="reset-buttons">
              <button className="reset-yes" onClick={async () => {
                const user = authService.getCurrentUser();

                // 1. Clear Local State Immediately
                setCompletedGen2([]);
                setCurrentwordIndex(0);
                setStageTimer(0);
                setMascotMood('neutral');
                setPredictionHistory([]);
                setStabilityCount(0);
                setCurrentPrediction(null);

                // Close Overlays
                setShowCelebration(false);
                setShowStageComplete(false);
                setNewUnlockedBadge(null);
                setGoldenShoesUnlocked(false);

                // 2. Clear Backend
                if (user) {
                  try {
                    await userProgressService.resetStage(user.uid, 'Gen2');
                  } catch (e) {
                    console.warn('Backend reset failed (offline), but local reset applied.');
                  }

                  // Restart Timer
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
          completed={completedGen2.length}
          total={gen2Words.length}
          label="Your Progress"
        />
      </div>

      {/* word Navigator */}
      <div className="word-navigator">
        <h3>Choose a word</h3>
        <div className="azWords-scroll">
          {gen2Words.map((word, index) => (
            <button
              key={word}
              className={`word-btn ${index === currentwordIndex ? 'active' : ''} ${completedGen2.includes(word) ? 'completed' : ''
                }`}
              onClick={() => goToword(index)}
              disabled={isAdvancing}
            >
              {word}
              {completedGen2.includes(word) && (
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
                src={getWordImage(currentword)}
                alt={`Sign for ${currentword}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/placeholder-sign.png';
                }}
              />
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
              {(wordTips[currentword] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                <li key={i}>✓ {tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Center Panel - Camera */}
        <div className="camera-panel">
          <CameraFeedGen2
            currentword={currentword}
            onPrediction={handlePrediction}
            predictionService={predictionServiceGen2}
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
            <div className={`status-item ${stable ? '✓' : '○'}`}>
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
          onClick={prevword}
          disabled={currentwordIndex === 0 || isAdvancing}
        >
          ← Previous
        </button>
        <button className="control-btn pause">⏸ Pause</button>
        <button
          className="control-btn skip"
          onClick={skipword}
          disabled={currentwordIndex === gen2Words.length - 1 || isAdvancing}
        >
          Skip →
        </button>
      </div>

      {/* Celebration Modal */}
      {showCelebration && (
        <div className="celebration-modal">
          <div className="celebration-content">
            <img
              src="/assets/avatar/mascot_hat_glasses.png"
              alt="Celebration"
              className="celebration-mascot"
              style={{ marginRight: '65px' }}
            />
            <h1>🎉 Excellent!</h1>
            <div className="celebration-word">{currentword}</div>
            <p>word {currentword} completed!</p>
            <div className="celebration-progress">
              {completedGen2.length}/{gen2Words.length} words Mastered ({progressPercentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Badge Celebration Modal */}
      <CelebrationModal
        badge={newUnlockedBadge}
        onClose={handleCelebrationClose}
      />

      {/* Stage Complete Overlay with Badge */}
      {showStageComplete && (
        <div className="stage-complete-modal">
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={true} />
          <div className="stage-complete-content">
            <img
              src={goldenShoesUnlocked ? "/assets/avatar/mascot_golden_shoes.png" : "/assets/avatar/mascot_hat_glasses.png"}
              alt="Unlock"
              className="badge-mascot"
              style={{ marginTop: '20px' }}
            />
            <h1>🎉 Congratulations!</h1>
            <h2>Idea Island Mastered!</h2>

            <div className="badge-awarded">
              <div className="badge-icon">
                <img src="/assets/badges/badge_idea_master.png" alt="Idea Master" style={{ width: '60px', height: '60px' }} />
              </div>
              <p>You received the <strong>Idea Master</strong> badge!</p>
            </div>

            {goldenShoesUnlocked ? (
              <div className="unlock-notice" style={{ background: 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)', color: 'black', padding: '15px', borderRadius: '15px', margin: '20px 0' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>👟 Golden Shoes Unlocked!</p>
                <p>🌴 Word Wonderland Completed!</p>
                <p style={{ fontSize: '0.9rem', marginTop: '5px' }}>Next Stop: Sentence Safari 🦁</p>
              </div>
            ) : (
              <div className="unlock-notice" style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '15px', borderRadius: '15px', margin: '20px 0' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>✨ New Stage Unlocked!</p>
                <p>🔓 Sentence Safari is now open!</p>
              </div>
            )}

            <button
              className="btn-primary"
              style={{ fontSize: '1.2rem', padding: '12px 30px', marginTop: '10px' }}
              onClick={async () => {
                const user = authService.getCurrentUser();
                if (user) {
                  // Ensure unlocking happens
                  await userProgressService.unlockStage(user.uid, 'sentence');
                }
                setShowStageComplete(false);
                navigate('/dashboard');
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

    </div >
  );
};

export default Gen2LessonPage;
