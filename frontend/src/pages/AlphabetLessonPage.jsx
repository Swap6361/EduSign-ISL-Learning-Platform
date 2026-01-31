import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedAZWords from '../components/CameraFeedAZWords';
import ProgressBar from '../components/ProgressBar';
import predictionServiceAZWords from '../services/predictionServiceAZWords';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const LessonPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { stage } = location.state || { stage: 'beginner' };

    // 26 A-Z Words with letter associations
    const azWordsWords = [
        { letter: 'A', word: 'Apple' },
        { letter: 'B', word: 'Banana' },
        { letter: 'C', word: 'Computer' },
        { letter: 'D', word: 'Deer' },
        { letter: 'E', word: 'Egg' },
        { letter: 'F', word: 'Fish' },
        { letter: 'G', word: 'Giraffe' },
        { letter: 'H', word: 'Hop' },
        { letter: 'I', word: 'Indian' },
        { letter: 'J', word: 'Jacket' },
        { letter: 'K', word: 'Knife' },
        { letter: 'L', word: 'Lion' },
        { letter: 'M', word: 'Mango' },
        { letter: 'N', word: 'Nail' },
        { letter: 'O', word: 'Octopus' },
        { letter: 'P', word: 'Pen' },
        { letter: 'Q', word: 'Quite' },
        { letter: 'R', word: 'Room' },
        { letter: 'S', word: 'Sun' },
        { letter: 'T', word: 'Table' },
        { letter: 'U', word: 'Umbrella' },
        { letter: 'V', word: 'Village' },
        { letter: 'W', word: 'Walk' },
        { letter: 'X', word: 'X-mas' },
        { letter: 'Y', word: 'Young' },
        { letter: 'Z', word: 'Zero' }
    ];
    const [currentwordIndex, setcurrentwordIndex] = useState(0);
    const [completedAZWords, setcompletedAZWords] = useState([]);
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
    const [cameraEnabled, setCameraEnabled] = useState(false); // Manual camera start

    const REQUIRED_STABILITY = 2;  // Reduced from 3 for faster completion
    const CONFIDENCE_THRESHOLD = 0.60;  // Lowered to 60% to match backend
    const currentWordObj = azWordsWords[currentwordIndex];
    const currentword = currentWordObj?.word || 'Apple'; // Just the word for matching
    const currentDisplay = `${currentWordObj?.letter} for ${currentWordObj?.word}`; // Display format

    // Load progress on mount and start timer
    useEffect(() => {
        const loadUserProgress = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                const userProgress = await userProgressService.getProgress(user.uid);
                if (userProgress?.completedAZWords) {
                    setcompletedAZWords(userProgress.completedAZWords);
                    // Find first incomplete word or start from beginning
                    const firstIncomplete = azWordsWords.findIndex(wordObj => !userProgress.completedAZWords.includes(wordObj.word));
                    if (firstIncomplete >= 0) {
                        setcurrentwordIndex(firstIncomplete);
                    }
                }
                // Resume timer if stage was in progress
                if (userProgress?.AZWordsTime && userProgress.completedAZWords?.length < 12) {
                    setStageTimer(userProgress.AZWordsTime);
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
                await userProgressService.updateStageTime(user.uid, 'AZWords', stageTimer);
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

        console.log('📊 [AZWords] Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentword, 'Index:', currentwordIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

        // Update current prediction display ALWAYS (prevents stuck display)
        setCurrentPrediction({ label, confidence: conf, stable: isStable });

        // CRITICAL: Don't process if we're already advancing
        if (isAdvancing) {
            console.log('⏸ [AZWords] Skipping prediction - already advancing');
            return;
        }

        // Check if already completed this word
        if (completedAZWords.includes(currentword)) {
            console.log('⚠️ [AZWords] Word', currentword, 'already completed');
            return;
        }

        // Only accept stable predictions that match the current word (case-insensitive)
        console.log('🔍 [AZWords] Checking match:', label.toUpperCase(), '===', currentword.toUpperCase(), '?', label.toUpperCase() === currentword.toUpperCase());
        console.log('🔍 [AZWords] Confidence check:', conf, '>=', CONFIDENCE_THRESHOLD, '?', conf >= CONFIDENCE_THRESHOLD);
        console.log('🔍 [AZWords] Stable check:', isStable);

        // Check for match
        if (label.toUpperCase() === currentword.toUpperCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
            console.log('✅ [AZWords] MATCH! Adding to history, Stability:', stabilityCount + 1);
            setPredictionHistory((prev) => {
                const next = [...prev, label].slice(-REQUIRED_STABILITY);
                const matches = next.filter(x => x.toUpperCase() === currentword.toUpperCase()).length;

                setStabilityCount(matches);

                // word completed!
                if (matches >= REQUIRED_STABILITY) {
                    // Double check not already completed and not advancing
                    if (!completedAZWords.includes(currentword) && !isAdvancing) {
                        const newCompleted = [...completedAZWords, currentword];
                        setcompletedAZWords(newCompleted);
                        setMascotMood('excited');
                        if (persistDayCompletionRef.current) {
                            persistDayCompletionRef.current(currentword, true);
                        }

                        // Check if stage is complete (all 26 AZWords)
                        if (newCompleted.length === azWordsWords.length) {
                            if (handleStageCompleteRef.current) {
                                handleStageCompleteRef.current();
                            }
                        } else {
                            // Auto-advance to next word
                            if (advanceToNextDayRef.current) {
                                advanceToNextDayRef.current();
                            } else {
                                console.error('❌ ERROR: advanceToNextDayRef.current is NULL or undefined!');
                            }
                        }
                    }
                }
                return next;
            });
        } else {
            // SMART RESET: Only reset if we see a DIFFERENT word with HIGH confidence
            // This prevents low-confidence noise/blurs from breaking the streak
            if (conf >= CONFIDENCE_THRESHOLD && label.toUpperCase() !== currentword.toUpperCase()) {
                console.log('⚠️ [AZWords] High confidence mismatch (' + label + '), resetting stability');
                if (label !== currentword) {
                    setMascotMood('sad');
                    if (persistDayCompletionRef.current) {
                        // Only log failure if it was a distinct wrong gesture, not just noise
                        persistDayCompletionRef.current(currentword, false);
                    }
                }
                setPredictionHistory([]);
                setStabilityCount(0);
            } else {
                // Low confidence or unstable - just ignore this frame (don't reset, don't add)
                console.log('⏳ [AZWords] Ignoring unstable/low-conf frame (Current stability kept: ' + stabilityCount + ')');
            }
        }
    }, [currentword, currentwordIndex, completedAZWords, isAdvancing, azWordsWords.length]);

    const persistDayCompletion = useCallback(async (word, isCorrect) => {
        const user = authService.getCurrentUser();
        if (!user) {
            console.error('❌ [AZWords] No user found, cannot save completion');
            return;
        }

        console.log('💾 [AZWords] Saving word completion to Firebase:', word, 'isCorrect:', isCorrect);

        if (isCorrect) {
            try {
                const result = await userProgressService.completeWord(user.uid, 'AZWords', word);

                if (result.success) {
                    console.log('✅ [AZWords] word saved to Firebase:', word, 'Result:', result);

                    if (result.newBadges && result.newBadges.length > 0) {
                        const allBadges = getAllBadges();
                        const badge = allBadges.find(b => b.name === result.newBadges[0]);
                        if (badge) {
                            console.log('🏆 New Badge Unlocked:', badge.name);
                            setNewUnlockedBadge(badge);
                        }
                    }
                } else {
                    console.error('❌ [AZWords] SAVE FAILED:', word, result.error);
                    // Optional: Revert local state here if strict consistency is needed
                }

                await userProgressService.setFeedback(user.uid, 'correct');
                await userProgressService.updateStreak(user.uid);

                // Track performance metrics
                const currentStreak = completedAZWords.length + 1;
                await userProgressService.updatePerformance(user.uid, {
                    noMistakeStreak: currentStreak,
                    perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
                    happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
                });
            } catch (error) {
                console.error('❌ [AZWords] Exception saving to Firebase:', error);
            }
        } else {
            await userProgressService.setFeedback(user.uid, 'wrong');
            const userProgress = await userProgressService.getProgress(user.uid);
            await userProgressService.updatePerformance(user.uid, {
                practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
            });
        }
    }, [completedAZWords.length]);

    // Handle stage complete
    const handleStageComplete = useCallback(async () => {
        const user = authService.getCurrentUser();
        if (user) {
            // Stop timer and save final time
            setIsTimerRunning(false);
            await userProgressService.updateStageTime(user.uid, 'AZWords', stageTimer);

            // Award badge and unlock next stage
            await userProgressService.completeStage(user.uid, 'AZWords', stageTimer);
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

            if (currentwordIndex < azWordsWords.length - 1) {
                const nextIndex = currentwordIndex + 1;
                setcurrentwordIndex(nextIndex);
            }
            setIsAdvancing(false);
        }
    };

    // Auto-advance to next word
    const advanceToNextDay = useCallback(() => {
        if (isAdvancing) {
            return;
        }

        setIsAdvancing(true);
        setShowCelebration(true);
        setMascotMood('excited');

        // FORCE RESET all prediction state
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);

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
                setCurrentPrediction(null);  // Double reset to ensure it clears

                if (currentwordIndex < azWordsWords.length - 1) {
                    const nextIndex = currentwordIndex + 1;
                    setcurrentwordIndex(nextIndex);
                }

                setIsAdvancing(false);
                return null;
            });
        }, 1000); // 1 second celebration
    }, [isAdvancing, currentword, currentwordIndex, azWordsWords.length]);

    // Update refs when functions change
    useEffect(() => {
        advanceToNextDayRef.current = advanceToNextDay;
        persistDayCompletionRef.current = persistDayCompletion;
        handleStageCompleteRef.current = handleStageComplete;
    }, [advanceToNextDay, persistDayCompletion, handleStageComplete]);

    useEffect(() => {
        const handler = (result) => handlePrediction(result);
        predictionServiceAZWords.onPrediction(handler);
        return () => {
            predictionServiceAZWords.offPrediction(handler);
        };
    }, [currentword, currentwordIndex, completedAZWords, isAdvancing, handlePrediction]);

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
        if (currentwordIndex < azWordsWords.length - 1) {
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
    const progressPercentage = Math.round((completedAZWords.length / azWordsWords.length) * 100);

    return (
        <div className="lesson-page">
            {/* Header */}
            <div className="lesson-header">
                <button className="back-button" onClick={async () => {
                    const user = authService.getCurrentUser();
                    if (user && stageTimer > 0) {
                        await userProgressService.updateStageTime(user.uid, 'AZWords', stageTimer);
                    }
                    navigate('/dashboard');
                }}>
                    ← Back to Dashboard
                </button>
                <h2>🏝️ Alphabet Island - Learn A-Z</h2>
                <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
                    🔄 Reset
                </button>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="reset-confirm-modal">
                    <div className="reset-confirm-content">
                        <h3>⚠️ Reset Progress?</h3>
                        <p>Are you sure you want to reset your AZWords Island progress? This will remove all completed AZWords and start from the beginning.</p>
                        <div className="reset-buttons">
                            <button className="reset-yes" onClick={async () => {
                                const user = authService.getCurrentUser();
                                if (user) {
                                    await userProgressService.resetStage(user.uid, 'AZWords');
                                    setcompletedAZWords([]);
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
                    completed={completedAZWords.length}
                    total={azWordsWords.length}
                    label="Your Progress"
                />
            </div>

            {/* word Navigator */}
            <div className="word-navigator">
                <h3>Choose a word</h3>
                <div className="azWords-scroll">
                    {azWordsWords.map((wordObj, index) => (
                        <button
                            key={wordObj.word}
                            className={`word-btn ${index === currentwordIndex ? 'active' : ''} ${completedAZWords.includes(wordObj.word) ? 'completed' : ''
                                }`}
                            onClick={() => goToDay(index)}
                            disabled={isAdvancing}
                        >
                            {wordObj.letter} - {wordObj.word}
                            {completedAZWords.includes(wordObj.word) && (
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
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                    background: '#000'
                                }}
                            >
                                <source src={`/a-zwords/${currentword} - Trim.mp4`} type="video/mp4" />
                            </video>
                        </div>
                        <div className="current-word-display">
                            <h1>{currentDisplay}</h1>
                            <p>Word: {currentword}</p>
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
                            word: 'white',
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
                                    word: '#667eea',
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
                        <CameraFeedAZWords
                            currentword={currentword}
                            onPrediction={handlePrediction}
                            predictionService={predictionServiceAZWords}
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
                                        Try to make Word: {currentword}
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
                    disabled={currentwordIndex === azWordsWords.length - 1 || isAdvancing}
                >
                    Skip →
                </button>
            </div>

            {/* Celebration Modal */}
            {showCelebration && (
                <div className="celebration-modal">
                    <div className="celebration-content">
                        <img
                            src="/assets/avatar/mascot_excited.png"
                            alt="Excited mascot"
                            className="celebration-mascot"
                        />
                        <h1>🎉 Excellent!</h1>
                        <p>Word completed!</p>
                        <div className="celebration-word" style={{ fontSize: '4rem', color: '#667eea' }}>{currentword}</div>
                        <div className="celebration-progress">
                            {completedAZWords.length}/{azWordsWords.length} Words Mastered ({progressPercentage}%)
                        </div>
                    </div>
                </div>
            )}

            {/* Badge Celebration Modal */}
            <CelebrationModal
                badge={newUnlockedBadge}
                onClose={handleCelebrationClose}
            />

            {/* All AZWords Completed (fallback) */}
            {completedAZWords.length === azWordsWords.length && !isAdvancing && !showStageComplete && (
                <div className="completion-modal">
                    <div className="completion-content">
                        <h1>🌟 Congratulations!</h1>
                        <h2>You've Completed All 26 AZWords!</h2>
                        <p>You've mastered the entire AZWords including J!</p>
                        <div className="stats-summary">
                            <div className="stat-box">
                                <div className="stat-number">{azWordsWords.length}</div>
                                <div className="stat-label">AZWords Mastered</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-number">100%</div>
                                <div className="stat-label">Progress</div>
                            </div>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/dashboard')}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            )}


            {showStageComplete && (
                <div className="stage-complete-modal">
                    <Confetti width={window.innerWidth} height={window.innerHeight} />
                    <div className="stage-complete-content">
                        <img
                            src="/assets/avatar/mascot_golden_shoes.png"
                            alt="Mascot with Golden Shoes"
                            className="badge-mascot mascot-bounce"
                            style={{ width: '150px', marginBottom: '20px' }}
                        />
                        <h1 style={{ fontSize: '2.5rem', color: '#2D3748', marginBottom: '10px' }}>🎉 Stage Complete!</h1>
                        <h2 style={{ fontSize: '1.5rem', color: '#ff8c42', marginBottom: '30px' }}>Word Wonderland Conquered!</h2>

                        <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '20px', borderRadius: '15px', marginBottom: '30px', border: '2px solid #48BB78' }}>
                            <p style={{ fontSize: '1.3rem', color: '#2F855A', margin: '5px 0', fontWeight: 'bold' }}>👟 Golden Shoes Unlocked!</p>
                            <p style={{ fontSize: '1.1rem', color: '#4A5568' }}>Your mascot is ready to run!</p>
                        </div>

                        <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '20px', borderRadius: '15px', marginBottom: '30px' }}>
                            <img src="/assets/badges/badge_az_word_master.png" alt="A-Z Word Master Badge" className="badge-icon-img" style={{ width: '80px', height: '80px', marginBottom: '10px' }} />
                            <p style={{ fontSize: '1.2rem', color: '#2D3748' }}>You received the <strong>A-Z Word Master</strong> badge!</p>
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
        </div>
    );
};

export default LessonPage;











