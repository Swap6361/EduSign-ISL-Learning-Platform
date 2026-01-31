import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CameraFeed from '../components/CameraFeed';
import ProgressBar from '../components/ProgressBar';
import predictionService from '../services/predictionService';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import CelebrationModal from '../components/CelebrationModal';
import Confetti from 'react-confetti';
import { getAllBadges } from '../config/badges';

const LessonPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { stage } = location.state || { stage: 'Alphabet Island' };

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
    const [completedLetters, setCompletedLetters] = useState([]);
    const [currentPrediction, setCurrentPrediction] = useState(null);
    const [predictionHistory, setPredictionHistory] = useState([]);
    const [stabilityCount, setStabilityCount] = useState(0);
    const [showCelebration, setShowCelebration] = useState(false);
    const [newUnlockedBadge, setNewUnlockedBadge] = useState(null);
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

    const REQUIRED_STABILITY = 1;
    const CONFIDENCE_THRESHOLD = 0.60;
    const currentLetter = letters[currentLetterIndex];

    // Load progress on mount
    useEffect(() => {
        const loadUserProgress = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                const userProgress = await userProgressService.getProgress(user.uid);
                if (userProgress?.completedAZWords) {
                    // Convert old word format to letters
                    const validLetters = userProgress.completedAZWords.map(item => {
                        return item.length > 1 ? item.charAt(0).toUpperCase() : item.toUpperCase();
                    });
                    setCompletedLetters(validLetters);
                    const firstIncomplete = letters.findIndex(letter => !validLetters.includes(letter));
                    if (firstIncomplete >= 0) {
                        setCurrentLetterIndex(firstIncomplete);
                    }
                }
                if (userProgress?.AZWordsTime && userProgress.completedAZWords?.length < 26) {
                    setStageTimer(userProgress.AZWordsTime);
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
                await userProgressService.updateStageTime(user.uid, 'AZWords', stageTimer);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        };
    }, [stageTimer]);

    const letterTips = {
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

    // Handle prediction
    const handlePrediction = (result) => {
        if (result?.uiOnly) {
            setHandsDetected(result.handsDetected || false);
            setStable(result.stable || false);
            return;
        }

        if (!result?.success || !result?.label) {
            // FIX: Don't wipe history on empty frames, just ignore them
            // setPredictionHistory([]);
            // setStabilityCount(0);
            setMascotMood('neutral');
            return;
        }

        const label = String(result.letter || result.label).toUpperCase();
        const conf = Number(result.confidence || 0);
        const isStable = result.stable !== false;

        console.log('📊 Alphabet Prediction:', label, 'Confidence:', (conf * 100).toFixed(0) + '%', 'Target:', currentLetter, 'Stable:', isStable);
        console.log('🔍 State Check:', {
            currentLetter,
            isAdvancing,
            alreadyCompleted: completedLetters.includes(currentLetter),
            completedLetters,
            stabilityCount
        });

        setCurrentPrediction({ label, confidence: conf, stable: isStable });

        if (completedLetters.includes(currentLetter)) {
            console.log('⚠️ Letter already completed, skipping:', currentLetter);
            return;
        }

        if (isAdvancing) {
            console.log('⏸️ Currently advancing, skipping prediction');
            return;
        }

        // FIX: Check for match with leniency
        if (label === currentLetter && conf >= CONFIDENCE_THRESHOLD) {
            console.log('✅ MATCH! Adding to history');

            // Allow history update even if not perfectly stable, rely on history buffer for stability
            setPredictionHistory((prev) => {
                const next = [...prev, label].slice(-REQUIRED_STABILITY);
                const matches = next.filter(x => x === currentLetter).length;
                console.log('✓ Stability:', matches, '/', REQUIRED_STABILITY, 'History:', next);
                setStabilityCount(matches);

                if (matches >= REQUIRED_STABILITY && !completedLetters.includes(currentLetter) && !isAdvancing) {
                    console.log('🎯 STABILITY REACHED! Completing letter:', currentLetter);
                    // Trigger completion
                    completeCurrentLetter(currentLetter);
                }
                return next;
            });
        } else {
            // Only reset if we are consistently wrong to avoid flickering reset
            // But for now, let's just make sure we don't reset IF the label is the current letter but confidence is just slightly low?
            // No, the original code reset immediately if label !== currentLetter.
            // We should only reset if label is explicitly WRONG, not just null/unstable.
            if (label && label !== currentLetter && conf >= CONFIDENCE_THRESHOLD) {
                // Genuine wrong gesture
                setPredictionHistory([]);
                setStabilityCount(0);
                if (isStable) {
                    setMascotMood('sad');
                    // debounce wrong feedback?
                }
            }
            // If label === currentLetter but unstable, DO NOT RESET history. Just wait.
        }
    };

    const completeCurrentLetter = (letter) => {
        const newCompleted = [...completedLetters, letter];
        setCompletedLetters(newCompleted);
        setMascotMood('excited');
        persistLetterCompletion(letter, true);

        if (newCompleted.length === letters.length) {
            console.log('🏆 All letters complete!');
            handleStageComplete();
        } else {
            console.log('⏩ Advancing to next letter...');
            advanceToNextLetter();
        }
    };

    const persistLetterCompletion = async (letter, isCorrect) => {
        const now = Date.now();
        if (now - lastFeedbackTimeRef.current < 800) return;
        lastFeedbackTimeRef.current = now;

        const user = authService.getCurrentUser();
        if (!user) {
            console.error('❌ No user found for persistence');
            return;
        }

        console.log('💾 Persisting letter:', letter, 'isCorrect:', isCorrect);

        if (isCorrect) {
            try {
                // Save to Firebase using the correct method
                await userProgressService.completeLetter(user.uid, letter);
                console.log('✅ Letter saved to Firebase:', letter);

                // Check for milestone badges
                const totalCompleted = completedLetters.length + 1;
                console.log('📊 Total completed (including this one):', totalCompleted);

                // Check specifically for defined badges
                const allBadges = getAllBadges();
                let badgeIdToUnlock = null;

                if (totalCompleted === 5) badgeIdToUnlock = 'alpha_starter';
                else if (totalCompleted === 13) badgeIdToUnlock = 'alpha_halfway';
                else if (totalCompleted === 26) badgeIdToUnlock = 'alpha_master';

                if (badgeIdToUnlock) {
                    const badge = allBadges.find(b => b.id === badgeIdToUnlock);
                    if (badge) {
                        console.log('🎖️ Badge unlocked:', badge.name);
                        setNewUnlockedBadge(badge);
                    }
                }

                await userProgressService.setFeedback(user.uid, 'correct');
                await userProgressService.updateStreak(user.uid);
            } catch (error) {
                console.error('❌ Error saving to Firebase:', error);
            }
        } else {
            await userProgressService.setFeedback(user.uid, 'wrong');
        }
    };

    const handleStageComplete = async () => {
        const user = authService.getCurrentUser();
        if (!user) return;

        setIsTimerRunning(false);
        await userProgressService.updateStageTime(user.uid, 'AZWords', stageTimer);
        await userProgressService.completeStage(user.uid, 'alphabet', stageTimer);
        setShowStageComplete(true);
        setShowCelebration(true);
    };

    // FIX: Use ref to access fresh state inside setTimeout
    const completedLettersRef = useRef(completedLetters);
    useEffect(() => {
        completedLettersRef.current = completedLetters;
    }, [completedLetters]);

    const advanceTimeoutRef = useRef(null);

    // FIX: Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        };
    }, []);

    const advanceToNextLetter = () => {
        if (isAdvancing) return;

        setIsAdvancing(true);
        setShowCelebration(true);

        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);

        advanceTimeoutRef.current = setTimeout(() => {
            setShowCelebration(false);

            // STRICT LINEAR PROGRESSION: A -> B -> C
            // Matches user request "go one by one iteratively" and "don't go back"
            const nextIndex = currentLetterIndex + 1;

            if (nextIndex < letters.length) {
                console.log(`⏩ Advancing to next letter: ${letters[nextIndex]}`);
                setCurrentLetterIndex(nextIndex);
            } else {
                console.log('🏆 Reached end of alphabet!');
                handleStageComplete();
            }

            // Always clear state after move
            setPredictionHistory([]);
            setStabilityCount(0);
            setCurrentPrediction(null);
            setIsAdvancing(false);
            advanceTimeoutRef.current = null;
        }, 2000);
    };

    // Use ref to prevent stale closures
    const handlePredictionRef = useRef(null);
    handlePredictionRef.current = handlePrediction;

    useEffect(() => {
        const handler = (result) => {
            if (handlePredictionRef.current) {
                handlePredictionRef.current(result);
            }
        };
        predictionService.onPrediction(handler);
        return () => predictionService.offPrediction(handler);
    }, []); // Empty dependencies - register once only

    const goToLetter = (index) => {
        // Cancel any pending auto-advance
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        if (isAdvancing) setIsAdvancing(false); // Force unlock if manually overriding

        setShowCelebration(false); // Hide celebration if pending
        setMascotMood('neutral');

        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        setCurrentLetterIndex(index);
    };

    const skipLetter = () => {
        // Cancel pending
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        if (isAdvancing) setIsAdvancing(false);

        setShowCelebration(false);
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentLetterIndex < letters.length - 1) {
            setCurrentLetterIndex(currentLetterIndex + 1);
        }
    };

    const prevLetter = () => {
        // Cancel pending
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        if (isAdvancing) setIsAdvancing(false);

        setShowCelebration(false);
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        if (currentLetterIndex > 0) {
            setCurrentLetterIndex(currentLetterIndex - 1);
        }
    };

    const progressPercentage = Math.round((completedLetters.length / letters.length) * 100);

    return (
        <div className="lesson-page">
            <div className="lesson-header">
                <button className="back-button" onClick={() => navigate('/dashboard')}>
                    ← Return to Dashboard
                </button>
                <h2>🏝️ Alphabet Island - All 26 Letters!</h2>
                <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
                    🔄 Reset
                </button>
            </div>

            {/* Stage Complete Overlay with Badge */}
            {showStageComplete && (
                <div className="stage-complete-modal">
                    <div className="stage-complete-content">
                        <img src="/assets/avatar/mascot_hat_glasses.png" alt="Sign Basics Reward" className="badge-mascot" />
                        <h1>🎉 Stage Complete!</h1>
                        <h2>Alphabet Island Mastered!</h2>
                        <div className="badge-awarded">
                            <div className="badge-icon">🧢</div>
                            <p>You unlocked the <strong>Smarty Avatar</strong>!</p>
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

            {/* Badge Celebration Modal */}
            <CelebrationModal
                badge={newUnlockedBadge}
                onClose={() => setNewUnlockedBadge(null)}
            />

            {showResetConfirm && (
                <div className="reset-confirm-modal">
                    <div className="reset-confirm-content">
                        <h3>⚠️ Reset Progress?</h3>
                        <p>Are you sure you want to reset your Alphabet Island progress?</p>
                        <div className="reset-buttons">
                            <button className="reset-yes" onClick={async () => {
                                const user = authService.getCurrentUser();
                                if (user) {
                                    await userProgressService.resetStage(user.uid, 'alphabet');
                                    setCompletedLetters([]);
                                    setCurrentLetterIndex(0);
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
                    completed={completedLetters.length}
                    total={letters.length}
                    label="Your Progress"
                />
            </div>

            <div className="letter-navigator">
                <h3>Choose a Letter</h3>
                <div className="letters-scroll">
                    {letters.map((letter, index) => (
                        <button
                            key={letter}
                            className={`letter-btn ${index === currentLetterIndex ? 'active' : ''} ${completedLetters.includes(letter) ? 'completed' : ''
                                }`}
                            onClick={() => goToLetter(index)}
                            disabled={isAdvancing}
                        >
                            {letter}
                            {completedLetters.includes(letter) && (
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
                                key={currentLetter}
                                src={`/alphabet/${currentLetter}.jpg`}
                                alt={`ASL sign for letter ${currentLetter}`}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '250px', // FIX: Constrain height as requested
                                    objectFit: 'contain',
                                    borderRadius: '8px'
                                }}
                                onError={(e) => {
                                    e.target.src = `/alphabet/${currentLetter}.png`;
                                    e.target.onerror = () => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    };
                                }}
                            />
                            <div className="letter-display" style={{ fontSize: '8rem', display: 'none', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#FF8C42', fontWeight: 'bold' }}>{currentLetter}</div>
                        </div>
                        <div className="current-letter-display">
                            <h1>{currentLetter}</h1>
                            <p>Letter {currentLetter}</p>
                        </div>
                    </div>

                    <div className="tips-card">
                        <h4>💡 Quick Tips</h4>
                        <ul>
                            {(letterTips[currentLetter] || ['Keep hand steady', 'Position in center', 'Hold for 2 seconds']).map((tip, i) => (
                                <li key={i}>✓ {tip}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="camera-panel">
                    <CameraFeed
                        currentLetter={currentLetter}
                        onPrediction={handlePrediction}
                        useWebSocket={true}
                        predictionService={predictionService}
                    // featureSize={63} // REMOVE: Model seems to expect 126
                    />
                </div>

                <div className="feedback-panel">
                    <h3>🎯 Recognition</h3>

                    <div className="prediction-display">
                        {currentPrediction ? (
                            <>
                                <div className={`predicted-letter ${currentPrediction.label === currentLetter ? 'correct' : 'incorrect'
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

                                {currentPrediction.label === currentLetter && currentPrediction.confidence >= CONFIDENCE_THRESHOLD && currentPrediction.stable !== false ? (
                                    <div className="feedback-message success">
                                        ✓ Perfect! Keep it steady... ({stabilityCount}/{REQUIRED_STABILITY})
                                    </div>
                                ) : currentPrediction.label === currentLetter && currentPrediction.stable === false ? (
                                    <div className="feedback-message hint">
                                        ⏳ Good! Hold steady for recognition...
                                    </div>
                                ) : currentPrediction.label === currentLetter ? (
                                    <div className="feedback-message hint">
                                        📊 Good! Hold steadier for higher confidence
                                    </div>
                                ) : (
                                    <div className="feedback-message hint">
                                        Try to make letter {currentLetter}
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
                    onClick={prevLetter}
                    disabled={currentLetterIndex === 0 || isAdvancing}
                >
                    ← Previous
                </button>
                <button className="control-btn pause">⏸ Pause</button>
                <button
                    className="control-btn skip"
                    onClick={skipLetter}
                    disabled={currentLetterIndex === letters.length - 1 || isAdvancing}
                >
                    Skip →
                </button>
            </div>

            {
                showCelebration && (
                    <div className="celebration-modal">
                        <div className="celebration-content" style={{ maxWidth: '400px', padding: '30px' }}>
                            <img
                                src="/assets/avatar/mascot_hat.png"
                                alt="Mascot with Hat"
                                className="celebration-mascot"
                                style={{ width: '120px', height: '120px', margin: '0 auto 10px', display: 'block', position: 'relative', left: '60px' }}
                            />
                            <h1 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🎉 Excellent!</h1>
                            <div className="celebration-letter" style={{ fontSize: '4rem', margin: '10px 0' }}>{currentLetter}</div>
                            <p style={{ fontSize: '1rem', marginBottom: '10px' }}>Letter {currentLetter} completed!</p>
                            <div className="celebration-progress" style={{ fontSize: '0.9rem' }}>
                                {completedLetters.length}/{letters.length} Letters Mastered ({progressPercentage}%)
                            </div>
                        </div>
                    </div>
                )
            }
            <CelebrationModal
                badge={newUnlockedBadge}
                onClose={() => setNewUnlockedBadge(null)}
            />

            {
                showStageComplete && (
                    <div className="stage-complete-modal">
                        <Confetti width={window.innerWidth} height={window.innerHeight} />
                        <div className="stage-complete-content" style={{ padding: '20px' }}>
                            <img
                                src="/assets/avatar/mascot_hat_glasses.png"
                                alt="Mascot with Hat and Glasses"
                                className="badge-mascot mascot-bounce"
                                style={{ width: '90px', marginBottom: '5px' }}
                            />
                            <h1 style={{ fontSize: '1.8rem', color: '#2D3748', marginBottom: '5px' }}>🎉 Alphabet Island Mastered!</h1>
                            <h2 style={{ fontSize: '1.1rem', color: '#ff8c42', marginBottom: '10px' }}>All 26 Letters Complete!</h2>

                            <div className="unlock-notice" style={{ background: '#F0FFF4', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '2px solid #48BB78' }}>
                                <p style={{ fontSize: '1rem', color: '#2F855A', margin: '2px 0', fontWeight: 'bold' }}>🎓 Smarty Avatar Unlocked!</p>
                                <p style={{ fontSize: '0.8rem', color: '#4A5568', margin: '0' }}>Hat + Glasses! You conquered the alphabet!</p>
                            </div>

                            <div className="badge-awarded" style={{ background: '#FFF5F5', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
                                <img src="/assets/badges/badge_alphabet_master.png" alt="Alphabet Master Badge" className="badge-icon-img" style={{ width: '50px', height: '50px', marginBottom: '5px' }} />
                                <p style={{ fontSize: '0.9rem', color: '#2D3748', margin: '0' }}>You received the <strong>Alphabet Master</strong> badge!</p>
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
                )
            }
        </div >
    );
};

export default LessonPage;
