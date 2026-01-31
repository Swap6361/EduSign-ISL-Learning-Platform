import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti'; // Added Confetti
import ProgressBar from '../components/ProgressBar';
import CameraFeedSentence from '../components/CameraFeedSentence';
import GrandFinaleModal from '../components/GrandFinaleModal';
import CelebrationModal from '../components/CelebrationModal'; // Added CelebrationModal
import predictionServiceSentence from '../services/predictionServiceSentence';
import predictionServiceSpelling from '../services/predictionServiceSpelling';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import { getAllBadges } from '../config/badges'; // Added badges config

const SentenceLessonPage = () => {
    const navigate = useNavigate();

    // 7 Sentences - MUST match backend labels_sentences.json EXACTLY
    const sentences = [
        'Good morning, everyone',
        'What is your name _',
        'My Name is', // Triggers spelling mode
        'How are you _',
        'I am fine',
        'What are you doing _',
        'I am studying indian sign language'
    ];

    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [completedSentences, setCompletedSentences] = useState([]);
    const [currentPrediction, setCurrentPrediction] = useState(null);
    const [predictionHistory, setPredictionHistory] = useState([]);
    const [stabilityCount, setStabilityCount] = useState(0);
    const [showCelebration, setShowCelebration] = useState(false);
    const [handsDetected, setHandsDetected] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [mascotMood, setMascotMood] = useState('neutral');
    const [showStageComplete, setShowStageComplete] = useState(false);
    const [showGrandFinale, setShowGrandFinale] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(false); // Replaces cameraStarted
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [stageStartTime, setStageStartTime] = useState(null);
    const [stageTimer, setStageTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [newUnlockedBadge, setNewUnlockedBadge] = useState(null); // State for new badge
    const timerIntervalRef = useRef(null);

    // Spelling Mode State
    const [spellingMode, setSpellingMode] = useState(false);
    const [userName, setUserName] = useState('');
    const [spellingProgress, setSpellingProgress] = useState(0);
    const [currentLetterPrediction, setCurrentLetterPrediction] = useState(null);
    const [spellingStability, setSpellingStability] = useState(0);

    const SEQ_LEN = 60; // Still used for display in CameraFeedSentence
    const REQUIRED_STABILITY = 1;
    const REQUIRED_SPELLING_STABILITY = 1; // Relaxed from 2 to help with tricky letters
    const CONFIDENCE_THRESHOLD = 0.40;
    const currentSentence = sentences[currentSentenceIndex];

    // Helper to clean sentence for display (remove underscores)
    const getDisplaySentence = (sent) => {
        return sent.replace(/ _/g, '').trim();
    };

    // Helper to get video filename - maps backend labels to actual video files
    const getVideoFilename = (sent) => {
        // Map of backend label → video filename (to handle capitalization differences)
        const videoMap = {
            'Good morning, everyone': 'Good morning, everyone',
            'What is your name _': 'What is your name',
            'My Name is': 'My name is', // Backend has capital N, video has lowercase n
            'How are you _': 'How are you',
            'I am fine': 'I am Fine', // Backend has lowercase f, video has capital F
            'What are you doing _': 'What are you doing',
            'I am studying indian sign language': 'I am studying indian sign language'
        };

        return videoMap[sent] || sent.replace(/ _/g, '').trim();
    };

    const advanceToNextSentenceRef = useRef(null);
    const persistSentenceCompletionRef = useRef(null);
    const handleStageCompleteRef = useRef(null);
    const advanceSpellingRef = useRef(null);

    // Load progress & User Name
    useEffect(() => {
        const loadUserProgress = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                // Get Name
                const profile = await authService.getUserProfile(user.uid);
                // Use profile name or 'USER' if missing. Strip formatting.
                let name = (profile?.displayName || user.displayName || 'USER').toUpperCase().replace(/[^A-Z]/g, '');
                if (name.length === 0) name = 'USER';
                setUserName(name);

                const userProgress = await userProgressService.getProgress(user.uid);
                if (userProgress?.completedSentences) {
                    setCompletedSentences(userProgress.completedSentences);
                    const firstIncomplete = sentences.findIndex(s => !userProgress.completedSentences.includes(s));
                    if (firstIncomplete >= 0) {
                        setCurrentSentenceIndex(firstIncomplete);
                    }
                }
                // Resume timer
                if (userProgress?.sentenceTime && userProgress.completedSentences?.length < sentences.length) {
                    setStageTimer(userProgress.sentenceTime);
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
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isTimerRunning]);

    // Save timer logic
    useEffect(() => {
        const handleBeforeUnload = async () => {
            const user = authService.getCurrentUser();
            if (user && stageTimer > 0) {
                await userProgressService.updateStageTime(user.uid, 'sentence', stageTimer);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        };
    }, [stageTimer]);

    // --- Prediction Handlers ---

    // 1. Sentence Prediction
    const handleSentencePrediction = useCallback((result) => {
        if (spellingMode) return;
        if (!result || !result.success || !result.sentence) return;

        const rawSentence = String(result.sentence);
        const sentence = rawSentence.trim();
        const target = currentSentence.trim(); // Normalize

        // Case-Insensitive Comparison
        const predictionNormalized = sentence.toLowerCase();
        const targetNormalized = target.toLowerCase();

        const conf = Number(result.confidence || 0);

        // ... (logging removed for brevity) ...

        setCurrentPrediction({ label: sentence, confidence: conf });

        if (isAdvancing) return; // Only block if actively animating transition

        // Check Match - IMMEDIATE ADVANCEMENT (Batch Mode)
        // Now using Case-Insensitive matching
        if (predictionNormalized === targetNormalized && conf >= CONFIDENCE_THRESHOLD) {
            console.log(`✅ MATCH! Prediction: "${sentence}" matched using strictness "${target}"`);

            // Visual Update: Show 100% stability
            setStabilityCount(1);

            // Bypass stability check entirely for Sentence Mode
            if (currentSentence === 'My Name is') {
                console.log('✨ Triggering Spelling Mode for user:', userName);
                setSpellingMode(true);
                setSpellingProgress(0);
                setPredictionHistory([]);
                setStabilityCount(0);
                setMascotMood('excited');
            } else {
                completeSentence(currentSentence);
            }

        } else {
            setStabilityCount(0);
        }
    }, [currentSentence, completedSentences, isAdvancing, sentences.length, spellingMode, userName]);

    // 2. Letter/Spelling Prediction
    const handleLetterPrediction = useCallback((result) => {
        if (!spellingMode) return;
        if (isAdvancing) {
            return;
        }

        if (!result || !result.success) {
            return;
        }

        const letter = String(result.letter || result.label).toUpperCase();
        const conf = Number(result.confidence || 0);

        // Safety check
        if (spellingProgress >= userName.length) {
            return;
        }

        const target = userName[spellingProgress];

        setCurrentLetterPrediction({ label: letter, confidence: conf });

        // Check Match
        if (letter === target && conf >= 0.5) {
            setPredictionHistory((prev) => {
                if (isAdvancing) {
                    return prev;
                }

                const next = [...prev, letter].slice(-REQUIRED_SPELLING_STABILITY);
                const matches = next.filter(x => x === target).length;

                setSpellingStability(matches);

                if (matches >= REQUIRED_SPELLING_STABILITY) {
                    if (advanceSpellingRef.current) {
                        advanceSpellingRef.current();
                    }
                }
                return next;
            });
        } else {
            setPredictionHistory([]);
            setSpellingStability(0);
        }
    }, [spellingMode, userName, spellingProgress, isAdvancing]);


    const completeSentence = (sentence) => {
        if (isAdvancing) {
            console.log('⏸️ Already advancing, blocking completeSentence');
            return;
        }

        console.log(`🎉 completeSentence CALLED for: "${sentence}"`);

        const newCompleted = [...completedSentences, sentence];
        setCompletedSentences(newCompleted);
        setMascotMood('excited');

        if (persistSentenceCompletionRef.current) {
            persistSentenceCompletionRef.current(sentence, true);
        }

        // TRIGGER BADGES LOCALLY (1st and 3rd sentence)
        const count = newCompleted.length;
        if (count === 1) {
            const badge = getAllBadges().find(b => b.id === 'sentence_first');
            if (badge) setNewUnlockedBadge(badge);
        } else if (count === 3) {
            const badge = getAllBadges().find(b => b.id === 'sentence_mid');
            if (badge) setNewUnlockedBadge(badge);
        }

        // Check if this is "My name is" - trigger spelling mode
        if (sentence === 'My name is') {
            console.log('🔤 Triggering spelling mode for name!');
            setSpellingMode(true);
            setSpellingProgress(0);
            return;
        }

        if (newCompleted.length === sentences.length) {
            console.log('🏆 ALL SENTENCES COMPLETE! Triggering stage complete...');
            if (handleStageCompleteRef.current) handleStageCompleteRef.current();
        } else {
            console.log('➡️ Advancing to next sentence...');
            if (advanceToNextSentenceRef.current) {
                advanceToNextSentenceRef.current();
            }
        }
    };

    const advanceSpelling = useCallback(() => {
        const currentLetter = userName[spellingProgress];

        // 1. Lock predictions immediately
        setIsAdvancing(true);

        // 2. Show Instant Feedback
        setMascotMood('excited');
        setShowCelebration(true);

        // 3. Delay advancement slightly to show the success
        setTimeout(() => {
            setShowCelebration(false);
            setPredictionHistory([]);
            setStabilityCount(0);
            setSpellingStability(0);
            setCurrentLetterPrediction(null);

            if (spellingProgress < userName.length - 1) {
                const nextProgress = spellingProgress + 1;
                setSpellingProgress(nextProgress);
                setMascotMood('neutral');
                setIsAdvancing(false);
            } else {
                // ALL LETTERS COMPLETE!
                // Wait a moment for user to see the final celebration
                setTimeout(() => {
                    setShowCelebration(false);
                    setSpellingMode(false);
                    setIsAdvancing(false);
                    setSpellingProgress(0); // Reset for next time

                    // Mark "My Name is" as complete and advance to next sentence
                    // Pass true to bypass isAdvancing check (fixes race condition)
                    completeSentence('My Name is', true);
                }, 1000); // Brief pause before transition
            }
        }, 1500);
    }, [spellingProgress, userName, completedSentences, completeSentence]);

    // Skip current letter (for model accuracy issues)
    const skipCurrentLetter = useCallback(() => {
        if (!spellingMode || isAdvancing) return;

        // Trigger the same advancement logic
        if (advanceSpellingRef.current) {
            advanceSpellingRef.current();
        }
    }, [spellingMode, isAdvancing, userName, spellingProgress]);

    const persistSentenceCompletion = useCallback(async (sentence, isCorrect) => {
        const user = authService.getCurrentUser();
        if (!user) return;
        if (isCorrect) {
            try {
                await userProgressService.completeSentence(user.uid, sentence);
            } catch (error) {
                console.error('Error saving:', error);
            }
        }
    }, []);

    const handleStageComplete = useCallback(async () => {
        const user = authService.getCurrentUser();
        if (user) {
            await userProgressService.updateStageTime(user.uid, 'sentence', stageTimer);
            await userProgressService.completeStage(user.uid, 'sentence', stageTimer);

            // Check for Grand Finale (all stages complete)
            const progress = await userProgressService.getProgress(user.uid);
            const isLegend = userProgressService.isAllStagesComplete(progress);

            if (isLegend) {
                console.log('🎉🏆 GRAND FINALE! All ISL stages completed!');
                setShowGrandFinale(true);
                // Award final badge if not already awarded
                await userProgressService.checkAndAwardBadges(user.uid);
            } else {
                // STANDARD COMPLETION - with 'Sign Fluent' badge
                setShowStageComplete(true);
                setShowCelebration(true);
            }
        }
        setMascotMood('excited');
    }, [stageTimer]);

    const advanceToNextSentence = useCallback(() => {
        console.log('🚀 advanceToNextSentence CALLED | isAdvancing:', isAdvancing, '| currentIndex:', currentSentenceIndex);

        // Don't block - completeSentence handles blocking
        setIsAdvancing(true);
        setShowCelebration(true);
        setMascotMood('excited');

        setTimeout(() => {
            setShowCelebration(false);
            setMascotMood('neutral');
            setPredictionHistory([]);
            setStabilityCount(0);
            setCurrentPrediction(null);
            if (currentSentenceIndex < sentences.length - 1) {
                const nextIndex = currentSentenceIndex + 1;
                console.log(`➡️ Advancing from index ${currentSentenceIndex} to ${nextIndex}`);
                setCurrentSentenceIndex(nextIndex);
            }
            setIsAdvancing(false);
        }, 1500);
    }, [isAdvancing, currentSentenceIndex, sentences.length]);

    useEffect(() => {
        advanceToNextSentenceRef.current = advanceToNextSentence;
        persistSentenceCompletionRef.current = persistSentenceCompletion;
        handleStageCompleteRef.current = handleStageComplete;
        advanceSpellingRef.current = advanceSpelling;
    }, [advanceToNextSentence, persistSentenceCompletion, handleStageComplete, advanceSpelling]);

    // Service Listeners
    useEffect(() => {
        const sentenceHandler = (result) => handleSentencePrediction(result);
        const letterHandler = (result) => handleLetterPrediction(result);

        // We assume CameraFeedSentence manages connection state, but we can't register listeners 
        // until connection happens or we use a safe helper. 
        // Ideally, predictionService should queue listeners or be robust.
        // Our existing service implementation (viewed earlier) supports `onPrediction` anytime.

        predictionServiceSentence.onPrediction(sentenceHandler);
        predictionServiceSpelling.onPrediction(letterHandler);

        return () => {
            predictionServiceSentence.offPrediction(sentenceHandler);
            predictionServiceSpelling.offPrediction(letterHandler);
        };
    }, [handleSentencePrediction, handleLetterPrediction]);


    const goToSentence = (index) => {
        if (isAdvancing) return;
        if (spellingMode) setSpellingMode(false); // Cancel spelling if navigating away
        setPredictionHistory([]);
        setStabilityCount(0);
        setCurrentPrediction(null);
        setCurrentSentenceIndex(index);
    };

    return (
        <div className="lesson-page">
            {/* Header */}
            <div className="lesson-header">
                <button className="back-button" onClick={() => navigate('/dashboard')}>
                    ← Back to Dashboard
                </button>
                <h2>📝 Sentence Safari - Learn Sentences</h2>
                <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
                    🔄 Reset
                </button>
            </div>

            {/* Reset Confirmation */}
            {showResetConfirm && (
                <div className="reset-confirm-modal">
                    <div className="reset-confirm-content">
                        <h3>⚠️ Reset Progress?</h3>
                        <p>This will reset your Sentence Safari progress.</p>
                        <div className="reset-buttons">
                            <button className="reset-yes" onClick={async () => {
                                console.log('🔄 Reset button clicked');
                                try {
                                    const user = authService.getCurrentUser();
                                    if (user) {
                                        console.log('Resetting sentences for user:', user.uid);
                                        await userProgressService.resetStage(user.uid, 'sentence');
                                        setCompletedSentences([]);
                                        setCurrentSentenceIndex(0);
                                        setSpellingMode(false);
                                        setSpellingProgress(0);
                                        setPredictionHistory([]);
                                        setStabilityCount(0);
                                        setCurrentPrediction(null);
                                        setShowStageComplete(false); // Reset stage complete overlay
                                        setShowGrandFinale(false);   // Reset grand finale
                                        setShowCelebration(false);   // Reset celebration
                                        setNewUnlockedBadge(null);   // Reset any pending badge
                                        setMascotMood('neutral');    // Reset mascot
                                        console.log('✅ Reset complete');
                                    } else {
                                        console.error('No user found');
                                        alert('Please log in again');
                                    }
                                    setShowResetConfirm(false);
                                    // window.location.reload(); // Removed to prevent reload, state is already reset above
                                } catch (error) {
                                    console.error('❌ Reset error:', error);
                                    alert('Reset failed: ' + error.message);
                                }
                            }}>Yes, Reset</button>
                            <button className="reset-no" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress */}
            <div className="lesson-progress">
                <ProgressBar
                    completed={completedSentences.length}
                    total={sentences.length}
                    label="Sentences completed"
                />
            </div>


            {/* Sentence Navigator */}
            <div className="letter-navigator">
                <h3>Choose a Sentence</h3>
                <div className="azWords-scroll">
                    {sentences.map((sent, index) => (
                        <button
                            key={sent}
                            className={`word-btn ${index === currentSentenceIndex ? 'active' : ''} ${completedSentences.includes(sent) ? 'completed' : ''}`}
                            onClick={() => goToSentence(index)}
                            disabled={isAdvancing || spellingMode}
                            style={{ padding: '0 30px' }} // Extra padding for sentences
                        >
                            {index + 1}. {getDisplaySentence(sent)}
                            {completedSentences.includes(sent) && (
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
                        <h3>📖 Learn This</h3>

                        {/* Dynamic Content: Sentence OR Spelling */}
                        {!spellingMode ? (
                            <>
                                <video
                                    key={currentSentence}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    style={{
                                        width: '100%',
                                        height: '300px',
                                        objectFit: 'contain',
                                        borderRadius: '12px',
                                        background: '#000'
                                    }}
                                >
                                    <source src={`/sentences/${getVideoFilename(currentSentence)}.mp4`} type="video/mp4" />
                                </video>
                                <div className="current-sentence-display">
                                    <h2 style={{ fontSize: '1.5rem' }}>Sentence {currentSentenceIndex + 1}</h2>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7c6fd6' }}>{getDisplaySentence(currentSentence)}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <img
                                    key={userName[spellingProgress]}
                                    src={`/alphabet/${userName[spellingProgress]}.jpg`}
                                    alt={`Letter ${userName[spellingProgress]}`}
                                    style={{
                                        width: '100%',
                                        height: '300px',
                                        objectFit: 'contain',
                                        borderRadius: '12px'
                                    }}
                                />
                                <div className="current-letter-display">
                                    <h2 style={{ fontSize: '1.2rem' }}>Spell Your Name</h2>
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {userName.split('').map((char, i) => (
                                            <span key={i} style={{
                                                fontSize: '1.5rem',
                                                fontWeight: i === spellingProgress ? 'bold' : 'normal',
                                                color: i < spellingProgress ? '#4ade80' : i === spellingProgress ? '#000' : '#ccc',
                                                textDecoration: i === spellingProgress ? 'underline' : 'none'
                                            }}>
                                                {char}
                                            </span>
                                        ))}
                                    </div>
                                    <p>Sign the letter <strong>{userName[spellingProgress]}</strong></p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="tips-card">
                        <h4>💡 Quick Tips</h4>
                        {!spellingMode ? (
                            <>
                                <ul>
                                    <li>✓ Sign consistently for 2 seconds</li>
                                    <li>✓ Keep entire body in frame</li>
                                </ul>
                                <button
                                    onClick={() => completeSentence(currentSentence, true)}
                                    disabled={isAdvancing || completedSentences.includes(currentSentence)}
                                    style={{
                                        marginTop: '15px',
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #FFA726, #FF6F00)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: (isAdvancing || completedSentences.includes(currentSentence)) ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold',
                                        width: '100%',
                                        fontSize: '14px',
                                        opacity: (isAdvancing || completedSentences.includes(currentSentence)) ? 0.5 : 1
                                    }}
                                >
                                    ⏭️ Skip Sentence
                                </button>
                                <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7, textAlign: 'center' }}>
                                    Use if AI can't recognize
                                </p>
                            </>
                        ) : (
                            <>
                                <ul>
                                    <li>✓ Sign the letter clearly</li>
                                    <li>✓ Hold steady to confirm</li>
                                    <li>✓ Progress: {spellingProgress + 1}/{userName.length}</li>
                                </ul>
                                <button
                                    onClick={skipCurrentLetter}
                                    disabled={isAdvancing}
                                    style={{
                                        marginTop: '15px',
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #FFA726, #FF6F00)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isAdvancing ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold',
                                        width: '100%',
                                        fontSize: '14px',
                                        opacity: isAdvancing ? 0.5 : 1
                                    }}
                                >
                                    ⏭️ Skip Letter
                                </button>
                                <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7, textAlign: 'center' }}>
                                    Use if AI can't recognize
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Center Panel - Camera */}
                <div className="camera-panel">
                    {!cameraEnabled ? (
                        <div className="camera-placeholder">
                            <div className="camera-icon">📷</div>
                            <h3>Camera Ready</h3>
                            <p>Click below to start practicing</p>
                            <button onClick={() => setCameraEnabled(true)} className="start-camera-btn">
                                📹 Start Camera
                            </button>
                        </div>
                    ) : (
                        <div className="camera-container" style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                            <CameraFeedSentence
                                sentenceService={predictionServiceSentence}
                                spellingService={predictionServiceSpelling}
                                spellingMode={spellingMode}
                                targetLetter={userName[spellingProgress]}
                                cameraEnabled={cameraEnabled}
                                onPrediction={(res) => {
                                    // Can implement unified logic here if desired, 
                                    // but currently using service listeners for consistency
                                    console.log('Frame processed', res);
                                }}
                                onHandsDetected={setHandsDetected}
                                seqLen={SEQ_LEN} // Pass SEQ_LEN for buffer display
                            />
                        </div>
                    )}
                </div>

                {/* Right Panel - Feedback */}
                <div className="feedback-panel">
                    <h3>🎯 Recognition</h3>

                    <div className="prediction-display">
                        {!spellingMode ? (
                            /* SENTENCE FEEDBACK */
                            currentPrediction ? (
                                <>
                                    <div className="predicted-text" style={{ fontSize: '1rem', color: '#666', marginBottom: '8px' }}>
                                        Predicted: <span style={{ color: currentPrediction.label === currentSentence ? '#04CC85' : '#EF4444', fontWeight: 'bold' }}>
                                            {currentPrediction.label}
                                        </span>
                                    </div>

                                    <div className="confidence-meter">
                                        <label>Confidence</label>
                                        <div className="meter-track">
                                            <div
                                                className="meter-fill"
                                                style={{
                                                    width: `${currentPrediction.confidence * 100}%`,
                                                    background: currentPrediction.confidence >= CONFIDENCE_THRESHOLD ? '#04CC85' : '#FFD166'
                                                }}
                                            />
                                        </div>
                                        <span className="confidence-value">{(currentPrediction.confidence * 100).toFixed(0)}%</span>
                                    </div>

                                    {currentPrediction.label === currentSentence ? (
                                        <div className="feedback-message success">✓ Perfect matching!</div>
                                    ) : (
                                        currentPrediction.confidence > 0.6 && (
                                            <div className="feedback-message error" style={{ color: '#EF4444', fontWeight: 'bold' }}>
                                                ❌ Incorrect Sentence
                                            </div>
                                        )
                                    )}
                                </>
                            ) : (
                                <div className="prediction-placeholder">
                                    <span className="hand-icon">✋</span>
                                    <p>Sign: "{getDisplaySentence(currentSentence)}"</p>
                                </div>
                            )
                        ) : (
                            /* SPELLING FEEDBACK */
                            currentLetterPrediction ? (
                                <>
                                    <div className={`predicted-letter ${currentLetterPrediction.label === userName[spellingProgress] ? 'correct' : 'incorrect'}`} style={{ fontSize: '2rem' }}>
                                        {currentLetterPrediction.label}
                                    </div>
                                    <div className="confidence-meter">
                                        <label>Confidence</label>
                                        <div className="meter-track">
                                            <div
                                                className="meter-fill"
                                                style={{
                                                    width: `${currentLetterPrediction.confidence * 100}%`,
                                                    background: currentLetterPrediction.confidence >= 0.6 ? '#04CC85' : '#FFD166'
                                                }}
                                            />
                                        </div>
                                        <span className="confidence-value">{(currentLetterPrediction.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    {currentLetterPrediction.label === userName[spellingProgress] && (
                                        <div className="feedback-message success">Great! Hold it... ({spellingStability}/{REQUIRED_SPELLING_STABILITY})</div>
                                    )}
                                </>
                            ) : (
                                <div className="prediction-placeholder">
                                    <span className="hand-icon">👆</span>
                                    <p>Sign letter {userName[spellingProgress]}</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Stability Check for Sentence Mode */}
                    {!spellingMode && (
                        <div className="stability-card">
                            <h4>Recognition Status</h4>
                            <div className="stability-indicators">
                                <div className={`stability-dot ${stabilityCount >= 1 ? 'active' : ''}`} />
                            </div>
                            <p>{stabilityCount >= 1 ? 'Match Detected!' : 'Waiting for match...'}</p>
                        </div>
                    )}

                    {spellingMode && (
                        <div className="stability-card">
                            <h4>Stability Check</h4>
                            <div className="stability-indicators">
                                {[...Array(REQUIRED_SPELLING_STABILITY)].map((_, i) => (
                                    <div key={i} className={`stability - dot ${i < spellingStability ? 'active' : ''} `} />
                                ))}
                            </div>
                            <p>{spellingStability}/{REQUIRED_SPELLING_STABILITY} consistent</p>
                        </div>
                    )}

                    <div className="detection-status">
                        <div className={`status - item ${handsDetected ? 'active' : ''} `}>
                            {handsDetected ? '✓' : '○'} {spellingMode ? 'Hands Detected' : 'Body Detected'}
                        </div>
                        {/* Removed 'Position Ready' as it's less relevant with CameraFeedSentence handling */}
                    </div>

                    <div className="mascot-mood-small">
                        <img
                            src={mascotMood === 'excited' ? '/assets/avatar/mascot_excited.png' : '/assets/avatar/mascot.png'}
                            alt="Mascot"
                            className="mascot-mood-img"
                        />
                    </div>
                </div>
            </div>

            {/* Celebration Modal */}
            {showCelebration && (
                <div className="celebration-modal">
                    <div className="celebration-content">
                        <img
                            src="/assets/avatar/mascot_golden_shoes.png"
                            alt="Celebration"
                            className="celebration-mascot"
                            style={{ marginRight: '60px' }} // Shifted as requested
                        />
                        {spellingMode ? (
                            <>
                                <h1>✅ Perfect!</h1>
                                <p>Letter recognized!</p>
                                <div className="celebration-letter" style={{ fontSize: '4rem' }}>
                                    {userName[spellingProgress] || userName[spellingProgress - 1]}
                                </div>
                            </>
                        ) : (
                            <>
                                <h1>🎉 Excellent!</h1>
                                <p>Sentence completed!</p>
                                <div className="celebration-sentence">{currentSentence}</div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Debug Overlay */}
            <div style={{
                position: 'fixed', top: 0, left: 0, background: 'rgba(0,0,0,0.8)',
                color: '#0f0', padding: '10px', fontSize: '12px', zIndex: 9999,
                fontFamily: 'monospace', pointerEvents: 'none'
            }}>
                DEBUG MODE<br />
                Index: {currentSentenceIndex}<br />
                Advancing: {String(isAdvancing)}<br />
                Completed: {completedSentences.length}<br />
                Target: {currentSentence}<br />
                LastPred: {currentPrediction?.label}<br />
                Conf: {currentPrediction?.confidence?.toFixed(2)}
            </div>

            {/* Interim Badge Celebration */}
            {newUnlockedBadge && (
                <CelebrationModal
                    badge={newUnlockedBadge}
                    onClose={() => setNewUnlockedBadge(null)}
                />
            )}

            {/* Grand Finale Modal */}
            <GrandFinaleModal
                isOpen={showGrandFinale}
                onClose={() => setShowGrandFinale(false)}
                userName={userName}
            />

            {/* Stage Complete - Custom Sentence Safari Celebration */}
            {showStageComplete && (
                <div className="stage-complete-modal">
                    <Confetti numberOfPieces={300} recycle={true} />
                    <div className="stage-complete-content" style={{ animation: 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                                src="/assets/badges/badge_sentence_master.png"
                                alt="Sign Fluent Badge"
                                className="badge-mascot"
                                style={{ width: '150px', height: '150px', objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.6))' }}
                            />
                            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: '3rem', animation: 'bounce 2s infinite' }}>🦁</div>
                        </div>

                        <h1 style={{
                            fontSize: '2.5rem',
                            background: 'linear-gradient(45deg, #FFD700, #FFA500)',
                            webkitBackgroundClip: 'text',
                            webkitTextFillColor: 'transparent',
                            margin: '20px 0 10px'
                        }}>
                            Safari Complete!
                        </h1>

                        <h2 style={{ color: '#E0E7FF', fontSize: '1.5rem', marginBottom: '30px' }}>
                            You've Mastered All 7 Sentences!
                        </h2>

                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <button
                                className="btn-primary"
                                onClick={() => navigate('/profile')}
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                                    transform: 'scale(1.1)',
                                    fontSize: '1.2rem',
                                    padding: '12px 30px'
                                }}
                            >
                                ✨ See My Profile
                            </button>

                            <button
                                className="btn-secondary"
                                onClick={() => navigate('/dashboard')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '2px solid rgba(255, 255, 255, 0.2)',
                                    color: 'white'
                                }}
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SentenceLessonPage;
