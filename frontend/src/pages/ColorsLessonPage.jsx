import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeedColors from '../components/CameraFeedColors';
import ProgressBar from '../components/ProgressBar';
import predictionServiceColors from '../services/predictionServiceColors';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const ColorsLessonPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { stage } = location.state || { stage: 'beginner' };

    // Full colors including J (26 colors)
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Black', 'White', 'Grey'];
    const [currentColorIndex, setcurrentColorIndex] = useState(0);
    const [completedColors, setcompletedColors] = useState([]);
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
    const currentColor = colors[currentColorIndex];

    // Load progress on mount and start timer
    useEffect(() => {
        const loadUserProgress = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                const userProgress = await userProgressService.getProgress(user.uid);
                if (userProgress?.completedColors) {
                    setcompletedColors(userProgress.completedColors);
                    // Find first incomplete Color or start from beginning
                    const firstIncomplete = colors.findIndex(Color => !userProgress.completedColors.includes(Color));
                    if (firstIncomplete >= 0) {
                        setcurrentColorIndex(firstIncomplete);
                    }
                }
                // Resume timer if stage was in progress
                if (userProgress?.colorsTime && userProgress.completedColors?.length < 12) {
                    setStageTimer(userProgress.colorsTime);
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
                await userProgressService.updateStageTime(user.uid, 'colors', stageTimer);
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

        const label = String(result.color || result.label).toUpperCase();
        const conf = Number(result.confidence || 0);
        const isStable = result.stable !== false; // Default to true if not specified

        console.log('📊 [COLORS] Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentColor, 'Index:', currentColorIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

        // Update current prediction display
        setCurrentPrediction({ label, confidence: conf, stable: isStable });

        // CRITICAL: Don't process if we're already advancing
        if (isAdvancing) {
            console.log('⏸ [colors] Skipping prediction - already advancing');
            return;
        }

        // Check if already completed this Color
        if (completedColors.includes(currentColor)) {
            console.log('⚠️ [colors] Color', currentColor, 'already completed');
            return;
        }

        // Only accept stable predictions that match the current Color (case-insensitive)
        if (label.toUpperCase() === currentColor.toUpperCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
            console.log('✅ [colors] CONDITION MET: Adding to stability counter');
            setPredictionHistory((prev) => {
                console.log('📝 Previous history:', prev);
                const next = [...prev, label].slice(-REQUIRED_STABILITY);
                const matches = next.filter(x => x.toUpperCase() === currentColor.toUpperCase()).length;

                console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
                console.log('📊 State check:', {
                    matches,
                    required: REQUIRED_STABILITY,
                    meetsThreshold: matches >= REQUIRED_STABILITY,
                    currentColor,
                    completedColors,
                    alreadyCompleted: completedColors.includes(currentColor),
                    isAdvancing
                });
                setStabilityCount(matches);

                // Color completed!
                if (matches >= REQUIRED_STABILITY) {
                    console.log('🎯 STABILITY REACHED! Color:', currentColor, 'Completed:', completedColors, 'isAdvancing:', isAdvancing);

                    // Double check not already completed and not advancing
                    if (!completedColors.includes(currentColor) && !isAdvancing) {
                        console.log('✅ COMPLETING Color:', currentColor);
                        console.log('🚀 About to call advanceToNextDayRef.current');
                        console.log('🔍 Ref status:', {
                            refExists: !!advanceToNextDayRef.current,
                            refType: typeof advanceToNextDayRef.current
                        });

                        const newCompleted = [...completedColors, currentColor];
                        setcompletedColors(newCompleted);
                        setMascotMood('excited');
                        if (persistDayCompletionRef.current) {
                            persistDayCompletionRef.current(currentColor, true);
                        }

                        // Check if stage is complete (all 11 colors)
                        if (newCompleted.length === colors.length) {
                            console.log('🏆 ALL colors COMPLETE!');
                            if (handleStageCompleteRef.current) {
                                handleStageCompleteRef.current();
                            }
                        } else {
                            // Auto-advance to next Color
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
                            alreadyCompleted: completedColors.includes(currentColor),
                            isAdvancing
                        });
                    }
                }
                return next;
            });
        } else {
            // Reset stability if wrong Color or low confidence
            console.log('❌ CONDITION NOT MET - Resetting stability', {
                labelMatches: label === currentColor,
                label,
                currentColor,
                confAboveThreshold: conf >= CONFIDENCE_THRESHOLD,
                confidence: conf,
                threshold: CONFIDENCE_THRESHOLD,
                isStable
            });

            if (label !== currentColor) {
                console.log('❌ Wrong Color detected:', label, '(expected:', currentColor + ')');
                setMascotMood('sad');
                if (persistDayCompletionRef.current) {
                    persistDayCompletionRef.current(currentColor, false);
                }
            } else if (!isStable) {
                console.log('⏳ Waiting for stable prediction...');
            } else {
                console.log('⚠️ Low confidence:', (conf * 100).toFixed(0) + '% (need 65%+)');
            }
            setPredictionHistory([]);
            setStabilityCount(0);
        }
    }, [currentColor, currentColorIndex, completedColors, isAdvancing, colors.length]);

    const persistDayCompletion = useCallback(async (Color, isCorrect) => {
        const user = authService.getCurrentUser();
        if (!user) {
            console.error('❌ [colors] No user found, cannot save completion');
            return;
        }

        console.log('💾 [colors] Saving Color completion to Firebase:', Color, 'isCorrect:', isCorrect);

        if (isCorrect) {
            try {
                const result = await userProgressService.completeWord(user.uid, 'colors', Color);
                console.log('✅ [COLORS] Color saved to Firebase:', Color, 'Result:', result);

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
                const currentStreak = completedColors.length + 1;
                await userProgressService.updatePerformance(user.uid, {
                    noMistakeStreak: currentStreak,
                    perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
                    happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
                });
            } catch (error) {
                console.error('❌ [colors] Error saving to Firebase:', error);
            }
        } else {
            await userProgressService.setFeedback(user.uid, 'wrong');
            const userProgress = await userProgressService.getProgress(user.uid);
            await userProgressService.updatePerformance(user.uid, {
                practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
            });
        }
    }, [completedColors.length]);

    // Handle stage complete
    const handleStageComplete = useCallback(async () => {
        const user = authService.getCurrentUser();
        if (user) {
            // Stop timer and save final time
            setIsTimerRunning(false);
            await userProgressService.updateStageTime(user.uid, 'colors', stageTimer);

            // Award badge and unlock next stage
            await userProgressService.completeStage(user.uid, 'colors', stageTimer);
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

            if (currentColorIndex < colors.length - 1) {
                const nextIndex = currentColorIndex + 1;
                setcurrentColorIndex(nextIndex);
            }
            setIsAdvancing(false);
        }
    };

    // Auto-advance to next Color
    const advanceToNextDay = useCallback(() => {
        if (isAdvancing) {
            console.log('⏸ [colors] Already advancing, skipping');
            return;
        }

        console.log('🎯 [colors] Starting advance from Color', currentColor, 'index', currentColorIndex);
        setIsAdvancing(true);
        setShowCelebration(true);
        setMascotMood('excited');

        // Immediate state reset to allow next Color
        setTimeout(() => {
            // Check if badge is blocking
            setNewUnlockedBadge(prev => {
                if (prev) {
                    console.log('🏅 [colors] Badge detected! Hiding inline celebration to show badge modal.');
                    setShowCelebration(false);
                    return prev;
                }

                setShowCelebration(false);
                setMascotMood('neutral');
                setPredictionHistory([]);
                setStabilityCount(0);
                setCurrentPrediction(null);

                if (currentColorIndex < colors.length - 1) {
                    const nextIndex = currentColorIndex + 1;
                    const nextDay = colors[nextIndex];
                    console.log('➡️ [colors] Advancing to index', nextIndex, 'Color', nextDay);
                    setcurrentColorIndex(nextIndex);
                } else {
                    console.log('🏆 [colors] Completed all colors!');
                }

                console.log('✅ [colors] Advance complete, resetting isAdvancing to false');
                setIsAdvancing(false);
                return null;
            });
        }, 1000); // 1 second celebration
    }, [isAdvancing, currentColor, currentColorIndex, colors.length]);

    // Update refs when functions change
    useEffect(() => {
        advanceToNextDayRef.current = advanceToNextDay;
        persistDayCompletionRef.current = persistDayCompletion;
        handleStageCompleteRef.current = handleStageComplete;
    }, [advanceToNextDay, persistDayCompletion, handleStageComplete]);

    useEffect(() => {
        const handler = (result) => handlePrediction(result);
        predictionServiceColors.onPrediction(handler);
        console.log('🔄 Re-registered prediction handler for Color:', currentColor);
        return () => {
            predictionServiceColors.offPrediction(handler);
        };
    }, [currentColor, currentColorIndex, completedColors, isAdvancing, handlePrediction]);

    // Navigate to specific Color (manual navigation)
    const goToDay = (index) => {
        if (isAdvancing) {
            console.log('⏸ Cannot navigate while advancing');
            return;
        }

        console.log('📍 Manual navigation to index', index, 'Color', colors[index]);

        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        setcurrentColorIndex(index);
    };

    // Skip handler
    const skipDay = () => {
        if (isAdvancing) return;
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentColorIndex < colors.length - 1) {
            setcurrentColorIndex(currentColorIndex + 1);
        }
    };

    // Previous Color handler
    const prevDay = () => {
        if (isAdvancing) return;
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentColorIndex > 0) {
            setcurrentColorIndex(currentColorIndex - 1);
        }
    };

    // Calculate progress percentage
    const progressPercentage = Math.round((completedColors.length / colors.length) * 100);

    return (
        <div className="lesson-page">
            {/* Header */}
            <div className="lesson-header">
                <button className="back-button" onClick={async () => {
                    const user = authService.getCurrentUser();
                    if (user && stageTimer > 0) {
                        await userProgressService.updateStageTime(user.uid, 'colors', stageTimer);
                    }
                    navigate('/dashboard');
                }}>
                    ← Back to Dashboard
                </button>
                <h2>🎨 Color Canyon - Learn Colors</h2>
                <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
                    🔄 Reset
                </button>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="reset-confirm-modal">
                    <div className="reset-confirm-content">
                        <h3>⚠️ Reset Progress?</h3>
                        <p>Are you sure you want to reset your colors Island progress? This will remove all completed colors and start from the beginning.</p>
                        <div className="reset-buttons">
                            <button className="reset-yes" onClick={async () => {
                                const user = authService.getCurrentUser();
                                if (user) {
                                    await userProgressService.resetStage(user.uid, 'colors');
                                    setcompletedColors([]);
                                    setcurrentColorIndex(0);
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
                    completed={completedColors.length}
                    total={colors.length}
                    label="Your Progress"
                />
            </div>

            {/* Color Navigator */}
            <div className="word-navigator">
                <h3>Choose a Color</h3>
                <div className="azWords-scroll days-mode">
                    {colors.map((Color, index) => (
                        <button
                            key={Color}
                            className={`word-btn ${index === currentColorIndex ? 'active' : ''} ${completedColors.includes(Color) ? 'completed' : ''
                                }`}
                            onClick={() => goToDay(index)}
                            disabled={isAdvancing}
                        >
                            {Color}
                            {completedColors.includes(Color) && (
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
                                key={currentColor}
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
                                <source src={`/color/${currentColor} - Trim.mp4`} type="video/mp4" />
                            </video>
                        </div>
                        <div className="current-Color-display">
                            <h1>{currentColor}</h1>
                            <p>Color {currentColor}</p>
                            {currentColor === 'J' && (
                                <p className="motion-hint">⚡ Motion Required</p>
                            )}
                        </div>
                    </div>

                    <div className="tips-card">
                        <h4>💡 Quick Tips</h4>
                        <ul>
                            {(DayTips[currentColor] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                                <li key={i}>✓ {tip}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Center Panel - Camera */}
                <div className="camera-panel">
                    <CameraFeedColors
                        currentColor={currentColor}
                        onPrediction={handlePrediction}
                        predictionService={predictionServiceColors}
                        useWebSocket={true}
                    />
                </div>

                {/* Right Panel - Feedback */}
                <div className="feedback-panel">
                    <h3>🎯 Recognition</h3>

                    <div className="prediction-display">
                        {currentPrediction ? (
                            <>
                                <div className={`predicted-Color ${currentPrediction.label === currentColor ? 'correct' : 'incorrect'
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

                                {currentPrediction.label === currentColor && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                                    <div className="feedback-message success">
                                        ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                                    </div>
                                ) : currentPrediction.label === currentColor && currentPrediction.stable === false ? (
                                    <div className="feedback-message hint">
                                        ⏳ Good! Hold steady for recognition...
                                    </div>
                                ) : currentPrediction.label === currentColor ? (
                                    <div className="feedback-message hint">
                                        📊 Good! Hold steadier for higher confidence
                                    </div>
                                ) : (
                                    <div className="feedback-message hint">
                                        Try to make Color {currentColor}
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

                    {/* Badge Celebration Modal */}
                    <CelebrationModal
                        badge={newUnlockedBadge}
                        onClose={() => setNewUnlockedBadge(null)}
                    />

                    {showStageComplete && (
                        <div className="stage-complete-modal">
                            <Confetti width={window.innerWidth} height={window.innerHeight} />
                            <div className="stage-complete-content">
                                <img
                                    src="/assets/avatar/mascot_excited.png"
                                    alt="Excited Mascot"
                                    className="badge-mascot mascot-bounce"
                                    style={{ width: '150px', marginBottom: '20px' }}
                                />
                                <h1 style={{ fontSize: '2.5rem', color: '#2D3748', marginBottom: '10px' }}>🎉 Stage Complete!</h1>
                                <h2 style={{ fontSize: '1.5rem', color: '#ff8c42', marginBottom: '30px' }}>Colors Mastered!</h2>


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
                    disabled={currentColorIndex === 0 || isAdvancing}
                >
                    ← Previous
                </button>
                <button className="control-btn pause">⏸ Pause</button>
                <button
                    className="control-btn skip"
                    onClick={skipDay}
                    disabled={currentColorIndex === colors.length - 1 || isAdvancing}
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
                        <div className="celebration-word" style={{ fontSize: '2.5rem', margin: '5px 0' }}>{currentColor}</div>
                        <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Color {currentColor} completed!</p>
                        <div className="celebration-progress" style={{ fontSize: '0.8rem' }}>
                            {completedColors.length}/{colors.length} Colors Mastered ({progressPercentage}%)
                        </div>
                    </div>
                </div>
            )}

            {/* Badge Celebration Modal */}
            <CelebrationModal
                badge={newUnlockedBadge}
                onClose={handleCelebrationClose}
            />

            {/* All Colors Completed (fallback) */}
            {completedColors.length === colors.length && !isAdvancing && !showStageComplete && (
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
                        <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>All 11 Colors Mastered!</h2>

                        <div className="stats-summary" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
                            <div className="stat-box" style={{ background: '#F7FAFC', padding: '10px', borderRadius: '10px', minWidth: '80px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2D3748' }}>{colors.length}</div>
                                <div style={{ fontSize: '0.8rem', color: '#718096' }}>Colors</div>
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

            {showStageComplete && (
                <div className="stage-complete-modal">
                    <div className="stage-complete-content" style={{ padding: '20px' }}>
                        <img
                            src="/assets/avatar/mascot_hat_glasses.png"
                            alt="Mascot with Hat and Glasses"
                            className="badge-mascot mascot-bounce"
                            style={{ width: '90px', marginBottom: '5px' }}
                        />
                        <h1 style={{ fontSize: '2rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Stage Complete!</h1>
                        <h2 style={{ fontSize: '1.2rem', color: '#ff8c42', marginBottom: '15px' }}>Colors Mastered!</h2>

                        <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '2px solid #48BB78' }}>
                            <p style={{ fontSize: '1rem', color: '#2F855A', margin: '2px 0', fontWeight: 'bold' }}>👟 Golden Shoes Unlocked!</p>
                            <p style={{ fontSize: '0.8rem', color: '#4A5568', margin: '0' }}>Your mascot is ready to run!</p>
                        </div>

                        <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
                            <img src="/assets/badges/badge_rainbow_champ.png" alt="Rainbow Master Badge" className="badge-icon-img" style={{ width: '50px', height: '50px', marginBottom: '5px' }} />
                            <p style={{ fontSize: '0.9rem', color: '#2D3748', margin: '0' }}>You received the <strong>Rainbow Master</strong> badge!</p>
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

export default ColorsLessonPage;
