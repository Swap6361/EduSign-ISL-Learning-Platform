import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CameraFeed from '../components/CameraFeed';
import ProgressBar from '../components/ProgressBar';
import predictionServiceWords from '../services/predictionServiceWords';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';

const WordLessonPage = () => {
    const navigate = useNavigate();

    // Common general words for sign language
    const words = [
        'Hello', 'Goodbye', 'Thank You', 'Please', 'Sorry', 'Yes', 'No', 'Help',
        'Good', 'Bad', 'Happy', 'Sad', 'Love', 'Friend', 'Family', 'Home',
        'School', 'Play', 'Learn', 'Read', 'Write', 'Eat', 'Drink', 'Sleep'
    ];

    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [completedWords, setCompletedWords] = useState([]);
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
    const [stageStartTime, setStageStartTime] = useState(null);
    const [stageTimer, setStageTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const lastFeedbackTimeRef = useRef(0);
    const timerIntervalRef = useRef(null);
    const advanceToNextWordRef = useRef(null);
    const persistWordCompletionRef = useRef(null);
    const handleStageCompleteRef = useRef(null);

    const REQUIRED_STABILITY = 2;  // Reduced to 2 for better UX
    const CONFIDENCE_THRESHOLD = 0.60;
    const currentWord = words[currentWordIndex];

    // Load progress on mount and start timer
    useEffect(() => {
        const loadUserProgress = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                const userProgress = await userProgressService.getProgress(user.uid);
                if (userProgress?.completedGeneralWords) {
                    setCompletedWords(userProgress.completedGeneralWords);
                    // Find first incomplete word or start from beginning
                    const firstIncomplete = words.findIndex(word => !userProgress.completedGeneralWords.includes(word));
                    if (firstIncomplete >= 0) {
                        setCurrentWordIndex(firstIncomplete);
                    }
                }
                // Resume timer if stage was in progress
                if (userProgress?.generalWordsTime && userProgress.completedGeneralWords?.length < words.length) {
                    setStageTimer(userProgress.generalWordsTime);
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
                await userProgressService.updateStageTime(user.uid, 'generalWords', stageTimer);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        };
    }, [stageTimer]);

    const wordTips = {
        // Add specific tips for words if available, otherwise defaults will be used
        'Hello': ['Flat hand near forehead', 'Move outward in salute'],
        'Goodbye': ['Open hand', 'Wave fingers up and down'],
        'Thank You': ['Fingertips to chin', 'Move hand forward'],
        'Please': ['Flat hand on chest', 'Circular motion clockwise'],
        'Sorry': ['Fist on chest', 'Circular motion'],
        'Yes': ['Fist bobbing up and down', 'Like a head nod'],
        'No': ['Index and middle tap thumb', 'Double tap'],
        'Help': ['Fist on open palm', 'Lift both hands up']
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

        const label = String(result.label);
        const conf = Number(result.confidence || 0);
        const isStable = result.stable !== false; // Default to true if not specified

        console.log('📊 Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentWord, 'Index:', currentWordIndex, 'Stable:', isStable, 'isAdvancing:', isAdvancing);

        // Update current prediction display
        setCurrentPrediction({ label, confidence: conf, stable: isStable });

        // CRITICAL: Don't process if we're already advancing
        if (isAdvancing) {
            console.log('⏸ Skipping prediction - already advancing');
            return;
        }

        // Check if already completed this word
        if (completedWords.includes(currentWord)) {
            console.log('⚠️ Word', currentWord, 'already in completedWords');
            return;
        }

        // Only accept stable predictions that match the current word (case-insensitive)
        if (label.toLowerCase() === currentWord.toLowerCase() && conf >= CONFIDENCE_THRESHOLD && isStable) {
            console.log('✅ CONDITION MET: Adding to stability counter');
            setPredictionHistory((prev) => {
                const next = [...prev, label].slice(-REQUIRED_STABILITY);
                const matches = next.filter(x => x.toLowerCase() === currentWord.toLowerCase()).length; // Case-insensitive stability check

                console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
                setStabilityCount(matches);

                // Word completed!
                if (matches >= REQUIRED_STABILITY) {
                    console.log('🎯 STABILITY REACHED! Word:', currentWord);

                    // Double check not already completed and not advancing
                    if (!completedWords.includes(currentWord) && !isAdvancing) {
                        console.log('✅ COMPLETING WORD:', currentWord);

                        const newCompleted = [...completedWords, currentWord];
                        setCompletedWords(newCompleted);
                        setMascotMood('excited');
                        if (persistWordCompletionRef.current) {
                            persistWordCompletionRef.current(currentWord, true);
                        }

                        // Check if stage is complete
                        if (newCompleted.length === words.length) {
                            console.log('🏆 ALL WORDS COMPLETE!');
                            if (handleStageCompleteRef.current) {
                                handleStageCompleteRef.current();
                            }
                        } else {
                            // Auto-advance to next word
                            console.log('➡️ Triggering advancement...');
                            if (advanceToNextWordRef.current) {
                                advanceToNextWordRef.current();
                            }
                        }
                    }
                }
                return next;
            });
        } else {
            // Reset stability if wrong word or low confidence
            if (label.toLowerCase() !== currentWord.toLowerCase()) {
                console.log('❌ Wrong word detected:', label, '(expected:', currentWord + ')');
                setMascotMood('sad');
                if (persistWordCompletionRef.current) {
                    persistWordCompletionRef.current(currentWord, false);
                }
            } else if (!isStable) {
                console.log('⏳ Waiting for stable prediction...');
            } else {
                console.log('⚠️ Low confidence:', (conf * 100).toFixed(0) + '%');
            }
            setPredictionHistory([]);
            setStabilityCount(0);
        }
    }, [currentWord, currentWordIndex, completedWords, isAdvancing, words.length]);

    const persistWordCompletion = useCallback(async (word, isCorrect) => {
        console.log('💾 [Persist] Saving word:', word, 'isCorrect:', isCorrect);

        const user = authService.getCurrentUser();
        if (!user) {
            console.error('❌ [Persist] No user logged in');
            return;
        }

        if (isCorrect) {
            await userProgressService.completeWord(user.uid, 'generalWords', word); // Assuming 'generalWords' is the stage key
            await userProgressService.setFeedback(user.uid, 'correct');
            await userProgressService.updateStreak(user.uid);

            // Track performance metrics
            const currentStreak = completedWords.length + 1;
            await userProgressService.updatePerformance(user.uid, {
                noMistakeStreak: currentStreak,
                perfectStreak: currentStreak >= 3 ? 3 : currentStreak,
                happyMoodCount: (await userProgressService.getProgress(user.uid))?.happyMoodCount || 0 + 1
            });
        } else {
            await userProgressService.setFeedback(user.uid, 'wrong');
            const userProgress = await userProgressService.getProgress(user.uid);
            await userProgressService.updatePerformance(user.uid, {
                practiceAfterMistake: (userProgress?.practiceAfterMistake || 0) + 1
            });
        }
    }, [completedWords.length, stageTimer]);

    const handleStageComplete = useCallback(async () => {
        const user = authService.getCurrentUser();
        if (!user) return;

        // Stop timer and save final time
        setIsTimerRunning(false);
        await userProgressService.updateStageTime(user.uid, 'generalWords', stageTimer);

        // Award badge and unlock next stage
        await userProgressService.completeStage(user.uid, 'generalWords', stageTimer);
        setShowStageComplete(true);
        setShowCelebration(true);
    }, [stageTimer]);

    // Auto-advance to next word
    const advanceToNextWord = useCallback(() => {
        if (isAdvancing) {
            console.log('⏸ Already advancing, skipping');
            return;
        }

        console.log('🎯 Starting advance from word', currentWord);
        setIsAdvancing(true);
        setShowCelebration(true);
        setMascotMood('excited');

        // Immediate state reset to allow next word
        setTimeout(() => {
            setShowCelebration(false);
            setMascotMood('neutral');
            setPredictionHistory([]);
            setStabilityCount(0);
            setCurrentPrediction(null);

            if (currentWordIndex < words.length - 1) {
                const nextIndex = currentWordIndex + 1;
                const nextWord = words[nextIndex];

                console.log('➡️ Advancing to index', nextIndex, 'word', nextWord);
                setCurrentWordIndex(nextIndex);
            } else {
                console.log('🏆 Completed all words!');
            }

            console.log('✅ Advance complete, resetting isAdvancing to false');
            setIsAdvancing(false);
        }, 1000);
    }, [isAdvancing, currentWord, currentWordIndex, words.length]);

    // Update refs when functions change
    useEffect(() => {
        advanceToNextWordRef.current = advanceToNextWord;
        persistWordCompletionRef.current = persistWordCompletion;
        handleStageCompleteRef.current = handleStageComplete;
    }, [advanceToNextWord, persistWordCompletion, handleStageComplete]);

    useEffect(() => {
        // Ensure service is connected
        predictionServiceWords.connect();

        const handler = (result) => handlePrediction(result);
        // Use the specific service for Words
        predictionServiceWords.onPrediction(handler);
        console.log('🔄 Re-registered prediction handler for word:', currentWord);
        return () => {
            predictionServiceWords.offPrediction(handler);
        };
    }, [currentWord, currentWordIndex, completedWords, isAdvancing, handlePrediction]);

    // Navigate to specific word (manual navigation)
    const goToWord = (index) => {
        if (isAdvancing) {
            console.log('⏸ Cannot navigate while advancing');
            return;
        }

        console.log('📍 Manual navigation to index', index, 'word', words[index]);

        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        setCurrentWordIndex(index);
    };

    // Skip handler
    const skipWord = () => {
        if (isAdvancing) return;
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentWordIndex < words.length - 1) {
            setCurrentWordIndex(currentWordIndex + 1);
        }
    };

    // Previous word handler
    const prevWord = () => {
        if (isAdvancing) return;
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentWordIndex > 0) {
            setCurrentWordIndex(currentWordIndex - 1);
        }
    };

    // Calculate progress percentage
    const progressPercentage = Math.round((completedWords.length / words.length) * 100);

    return (
        <div className="lesson-page">
            {/* Header */}
            <div className="lesson-header">
                <button className="back-button" onClick={async () => {
                    const user = authService.getCurrentUser();
                    if (user && stageTimer > 0) {
                        await userProgressService.updateStageTime(user.uid, 'generalWords', stageTimer);
                    }
                    navigate('/dashboard');
                }}>
                    ← Back to Dashboard
                </button>
                <h2>🏝 General Words - All {words.length} Words!</h2>
                <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
                    🔄 Reset
                </button>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="reset-confirm-modal">
                    <div className="reset-confirm-content">
                        <h3>⚠️ Reset Progress?</h3>
                        <p>Are you sure you want to reset your General Words progress? This will remove all completed words and start from the beginning.</p>
                        <div className="reset-buttons">
                            <button className="reset-yes" onClick={async () => {
                                const user = authService.getCurrentUser();
                                if (user) {
                                    await userProgressService.resetStage(user.uid, 'generalWords');
                                    setCompletedWords([]);
                                    setCurrentWordIndex(0);
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
                    completed={completedWords.length}
                    total={words.length}
                    label="Your Progress"
                />
            </div>

            {/* Word Navigator */}
            <div className="letter-navigator">
                <h3>Choose a Word</h3>
                <div className="letters-scroll">
                    {words.map((word, index) => (
                        <button
                            key={word}
                            style={{ minWidth: '100px', fontSize: '1rem' }}
                            className={`letter-btn ${index === currentWordIndex ? 'active' : ''} ${completedWords.includes(word) ? 'completed' : ''
                                }`}
                            onClick={() => goToWord(index)}
                            disabled={isAdvancing}
                        >
                            {word}
                            {completedWords.includes(word) && (
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
                            <div className="letter-display" style={{ fontSize: '3rem' }}>{currentWord}</div>
                        </div>
                        <div className="current-letter-display">
                            <h1>{currentWord}</h1>
                            <p>Word {currentWord}</p>
                        </div>
                    </div>

                    <div className="tips-card">
                        <h4>💡 Quick Tips</h4>
                        <ul>
                            {(wordTips[currentWord] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                                <li key={i}>✓ {tip}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Center Panel - Camera */}
                <div className="camera-panel">
                    <CameraFeed
                        currentLetter={currentWord}
                        // Passing predictionService so CameraFeed can potentially use it if updated, 
                        // but standard CameraFeed might only use predictionService for Alphabet.
                        // However, we are handling predictions via handlePrediction callback which uses predictionServiceWords.
                        // The CameraFeed component displays the webcam.
                        // If CameraFeed internally uses `predictionService` (default export) we might have an issue.
                        // Let's check CameraFeed prop usage. 
                        // Update: Passing props as expected by standard CameraFeed
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
                                <div className={`predicted-letter ${currentPrediction.label.toLowerCase() === currentWord.toLowerCase() ? 'correct' : 'incorrect'
                                    }`} style={{ fontSize: '2rem' }}>
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

                                {currentPrediction.label.toLowerCase() === currentWord.toLowerCase() && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                                    <div className="feedback-message success">
                                        ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                                    </div>
                                ) : currentPrediction.label.toLowerCase() === currentWord.toLowerCase() && currentPrediction.stable === false ? (
                                    <div className="feedback-message hint">
                                        ⏳ Good! Hold steady for recognition...
                                    </div>
                                ) : currentPrediction.label.toLowerCase() === currentWord.toLowerCase() ? (
                                    <div className="feedback-message hint">
                                        📊 Good! Hold steadier for higher confidence
                                    </div>
                                ) : (
                                    <div className="feedback-message hint">
                                        Try to make word {currentWord}
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
                    onClick={prevWord}
                    disabled={currentWordIndex === 0 || isAdvancing}
                >
                    ← Previous
                </button>
                <button className="control-btn pause">⏸ Pause</button>
                <button
                    className="control-btn skip"
                    onClick={skipWord}
                    disabled={currentWordIndex === words.length - 1 || isAdvancing}
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
                        <div className="celebration-letter">{currentWord}</div>
                        <p>Word {currentWord} completed!</p>
                        <div className="celebration-progress">
                            {completedWords.length}/{words.length} Words Mastered ({progressPercentage}%)
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Complete Overlay with Badge */}
            {showStageComplete && (
                <div className="stage-complete-modal">
                    <div className="stage-complete-content">
                        <img
                            src="/assets/avatar/mascot_hat.png" // Placeholder, might want valid badge image
                            alt="Badge unlocked"
                            className="badge-mascot"
                        />
                        <h1>🎉 Stage Complete!</h1>
                        <h2>General Words Mastered!</h2>
                        <div className="badge-awarded">
                            <div className="badge-icon">🏆</div>
                            <p>You received the <strong>Words Master</strong> badge!</p>
                        </div>
                        <div className="unlock-notice">
                            <p>Word Universe unlocked!</p>
                        </div>
                        <button
                            className="btn-primary"
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

            {/* All Words Completed (fallback) */}
            {completedWords.length === words.length && !isAdvancing && !showStageComplete && (
                <div className="completion-modal">
                    <div className="completion-content">
                        <h1>🌟 Congratulations!</h1>
                        <h2>You've Completed All {words.length} Words!</h2>
                        <div className="stats-summary">
                            <div className="stat-box">
                                <div className="stat-number">{words.length}</div>
                                <div className="stat-label">Words Mastered</div>
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
        </div>
    );
};

export default WordLessonPage;
