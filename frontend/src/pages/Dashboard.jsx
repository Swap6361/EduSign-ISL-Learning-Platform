import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import WelcomeOverlay from '../components/WelcomeOverlay';
import BeginnerStagePage from './BeginnerStagePage';
import AnimatedSection from '../components/AnimatedSection';
import ProgressCard from '../components/ProgressCard';
import Mascot from '../components/Mascot';
import '../styles/dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [currentOverlayStep, setCurrentOverlayStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const welcomeSectionRef = useRef(null);
  const howItWorksRef = useRef(null);

  useEffect(() => {
    // Scroll to top on mount - multiple approaches for reliability
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Also scroll after a short delay to ensure DOM is ready
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadProgress(currentUser.uid);

      // Show welcome overlay for new users
      const showOverlay = localStorage.getItem('showWelcomeOverlay');
      if (showOverlay === 'true') {
        setShowWelcomeOverlay(true);
        localStorage.removeItem('showWelcomeOverlay');
      }
    }

    // Refresh progress when returning to dashboard
    const handleFocus = () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        loadProgress(currentUser.uid);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Scroll to section when navigation clicked
  useEffect(() => {
    if (showAbout && welcomeSectionRef.current) {
      welcomeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showAbout]);

  useEffect(() => {
    if (showHowItWorks && howItWorksRef.current) {
      howItWorksRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showHowItWorks]);

  const handleAboutClick = () => {
    setShowAbout(true);
    setShowHowItWorks(false);
    setTimeout(() => {
      if (welcomeSectionRef.current) {
        welcomeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleHowToUseClick = () => {
    setShowHowItWorks(true);
    setShowAbout(false);
    setTimeout(() => {
      if (howItWorksRef.current) {
        howItWorksRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleLetsStartClick = () => {
    navigate('/beginner-stage');
  };

  const loadProgress = async (uid) => {
    const userProgress = await userProgressService.getProgress(uid);
    // Ensure progress is never null to prevent lock due to missing doc
    setProgress(userProgress || {});
    setLoading(false);
  };

  const handleStartLesson = () => {
    navigate('/beginner-stage');
  };

  // Check which avatars are unlocked
  const unlockedAvatars = useMemo(() => {
    const lettersDone = progress?.completedLetters?.length || 0;
    const wordsDone = progress?.wordProgress?.completed || 0;
    return {
      hat: lettersDone >= 26,
      glasses: wordsDone >= 5
    };
  }, [progress]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your progress...</p>
      </div>
    );
  }

  const completedLetters = progress?.completedLetters?.length || 0;
  const totalLetters = 26;
  const progressPercentage = Math.round((completedLetters / totalLetters) * 100);

  const completedNumbers = progress?.completedNumbers?.length || 0;
  const totalNumbers = 10;

  // Check if Sign Basics Adventure is complete (both alphabet and numbers)
  // Be lenient: honor server flags, level, or strong progress (>=90% of basics or 24+ letters & 8+ numbers)
  const totalBasics = completedLetters + completedNumbers;
  const basicsPct = totalBasics / 36;

  // Check if Word Wonderland is complete (all 84 words)
  const completedAZWords = progress?.completedAZWords?.length || 0;  // 26
  const completedDays = progress?.completedDays?.length || 0;        // 7
  const completedColors = progress?.completedColors?.length || 0;    // 11
  const completedGeneralWords = (progress?.completedGen1?.length || 0) + (progress?.completedGen2?.length || 0);  // 40

  const totalWordWonderland = completedAZWords + completedDays + completedColors + completedGeneralWords;

  // CHECK: Sign Basics Completion (Alphabet + Numbers)
  const signBasicsCompleted = Boolean(
    progress?.signBasicsCompleted ||
    (completedLetters >= 26 && completedNumbers >= 10)
  );

  // CHECK: Word Wonderland Completion (All 84 words)
  // CHECK: Word Wonderland Completion (All 84 words)
  // CHECK: Word Wonderland Completion (All 84 words)
  const wordWonderlandComplete = totalWordWonderland >= 84;

  console.log('  Word Wonderland Progress:');
  console.log('  A-Z Words:', completedAZWords, '/26');
  console.log('  Days:', completedDays, '/7');
  console.log('  Colors:', completedColors, '/11');
  console.log('  General Words:', completedGeneralWords, '/40');
  console.log('  TOTAL:', totalWordWonderland, '/84');
  console.log('   COMPLETE:', wordWonderlandComplete);




  // Debug logging for Word Wonderland unlock status
  console.log('🔍 Dashboard - Word Wonderland Unlock Check:', {
    completedLetters,
    completedNumbers,
    totalBasics,
    signBasicsCompleted,
    flags: {
      signBasicsCompleted: progress?.signBasicsCompleted,
      alphabetCompleted: progress?.alphabetCompleted,
      numbersCompleted: progress?.numbersCompleted,
      level: progress?.level
    }
  });

  const wordTotal = progress?.wordProgress?.total || 25;
  const wordsDone = progress?.wordProgress?.completed || 0;
  const wordPct = Math.min(100, Math.round((wordsDone / wordTotal) * 100));

  const sentenceTotal = 7;
  const sentencesDone = progress?.completedSentences?.length || 0;
  const sentencePct = Math.min(100, Math.round((sentencesDone / sentenceTotal) * 100));

  const kidStats = [
    { icon: '🎯', label: 'Alphabet stars', value: `${completedLetters}/26` },
    { icon: '🌴', label: 'Word jungle', value: `${wordsDone}/${wordTotal}` },
    { icon: '🦁', label: 'Sentence safari', value: `${sentencesDone}/${sentenceTotal}` },
  ];

  const stats = [
    { icon: '⭐', label: 'Current Level', value: progress?.level || 'Beginner' }
  ];

  // Determine which mascot avatar to show based on progress
  const getCurrentMascotAvatar = () => {
    // Sign Language Legend (all stages complete)
    if (progress?.badges?.includes('Sign Language Legend')) {
      return 'mascot_legend';
    }
    // Golden Shoes (Sentence Safari complete)
    if ((progress?.completedSentences?.length || 0) >= 7) {
      return 'mascot_golden_shoes';
    }
    // Smarty Avatar - Hat + Glasses (Sign Basics complete: A-Z + Numbers)
    if (completedLetters >= 26 && (progress?.completedNumbers?.length || 0) >= 10) {
      return 'mascot_hat_glasses';
    }
    // Hat only (Alphabet complete)
    if (completedLetters >= 26) {
      return 'mascot_hat';
    }
    // Default mascot
    return 'mascot';
  };

  const currentMascotAvatar = getCurrentMascotAvatar();

  return (
    <div className="dashboard">
      {/* Welcome Overlay for New Users */}
      {showWelcomeOverlay && (
        <WelcomeOverlay
          userName={user?.displayName || 'Learner'}
          onClose={() => setShowWelcomeOverlay(false)}
        />
      )}

      {/* Header with Firebase Auth */}
      <motion.header
        className="dashboard-header"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="logo">
          <img src="/assets/avatar/mascot.png" alt="EduSign" className="logo-icon" />
          <h1>EduSign</h1>
        </div>
        <nav className="header-nav">
          <button className="nav-link" onClick={handleAboutClick}>About</button>
          <button className="nav-link" onClick={handleLetsStartClick}>Let's Start</button>
          <button className="nav-link" onClick={handleHowToUseClick}>How to use?</button>
        </nav>
        <div className="header-right">
          <div className="greeting-block">
            <span className="user-greeting">Hi, {user?.displayName || 'Learner'}! 👋</span>
          </div>
          <button className="profile-btn" onClick={() => navigate('/profile')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="profile-icon">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor" />
              <path d="M12.0002 14.5C6.99016 14.5 2.73016 17.86 2.73016 22C2.73016 22.28 2.95016 22.5 3.23016 22.5H20.7702C21.0502 22.5 21.2702 22.28 21.2702 22C21.2702 17.86 17.0102 14.5 12.0002 14.5Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </motion.header>

      {/* Welcome Banner for New Users */}
      {showWelcome && (
        <motion.div
          className="welcome-banner"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="welcome-content">
            <h2>🎉 Welcome to EduSign, {user?.displayName}!</h2>
            <p>Let's start your sign language journey!</p>
          </div>
        </motion.div>
      )}

      {/* Hero Section - Full Viewport with Background */}
      <AnimatedSection direction="up" delay={0.2}>
        <motion.section
          ref={welcomeSectionRef}
          className="hero-section-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {/* Background Image */}
          <div className="hero-background">
            <img
              src="/assets/dashboard_hero.png"
              alt="Children learning sign language"
              className="hero-bg-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.style.background = 'linear-gradient(135deg, #FF8C42 0%, #FFB17A 50%, #FFD166 100%)';
              }}
            />
            <div className="hero-overlay"></div>
          </div>

          {/* Content Overlay */}
          <div className="hero-content-overlay">
            <div className="hero-text-content">
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <h1 className="hero-title">🎓 Welcome to EduSign</h1>
                <p className="hero-subtitle">Indian Sign Language Learning Playground</p>
                <p className="hero-description">
                  Learn ISL with mini-adventures, cute avatars, and instant feedback. Collect hats, glasses, and stars as you master signs!
                </p>

                <div className="hero-actions">
                  <motion.button
                    className="hero-cta-btn"
                    onClick={handleStartLesson}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start Playing
                  </motion.button>
                  <motion.button
                    className="hero-ghost-btn"
                    onClick={() => navigate('/profile')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    View my rewards
                  </motion.button>
                </div>
              </motion.div>
            </div>

            {/* Mascot - Temporarily Removed */}
            {/* <div className="hero-mascot-container">
              <Mascot
                mood="wave"
                position="avatar"
                size="sm"
                avatar={currentMascotAvatar}
                className="hero-mascot"
              />
            </div> */}
          </div>

          {/* Scroll Indicator */}
          <motion.div
            className="scroll-indicator"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <span>Scroll to explore</span>
            <div className="scroll-arrow">↓</div>
          </motion.div>
        </motion.section>
      </AnimatedSection>

      {/* Current Phase Progress */}
      <motion.section
        className="current-phase-section"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="section-title">📊 Your Current Progress</h2>
        <div className="phase-progress-cards">
          <div className="phase-progress-card">
            <div className="phase-header">
              <span className="phase-icon">🌟</span>
              <h3>Sign Basics Adventure</h3>
            </div>
            <div className="phase-progress-bar-container">
              <div className="phase-progress-bar">
                <div
                  className="phase-progress-fill"
                  style={{ width: `${Math.round(((completedLetters + (progress?.completedNumbers?.length || 0)) / 36) * 100)}%` }}
                />
              </div>
              <span className="phase-progress-text">
                {completedLetters + (progress?.completedNumbers?.length || 0)} / 36 Complete
              </span>
            </div>
            <div className="phase-breakdown">
              <span className="breakdown-item">📝 Alphabet: {completedLetters}/26</span>
              <span className="breakdown-item">🔢 Numbers: {progress?.completedNumbers?.length || 0}/10</span>
            </div>
          </div>

          <div className="phase-progress-card">
            <div className="phase-header">
              <span className="phase-icon">🌈</span>
              <h3>Word Wonderland</h3>
            </div>
            <div className="phase-progress-bar-container">
              <div className="phase-progress-bar">
                <div
                  className="phase-progress-fill word"
                  style={{
                    width: `${Math.round((totalWordWonderland / 84) * 100)}%`
                  }}
                />
              </div>
              <span className="phase-progress-text">
                {totalWordWonderland} / 84 Complete
              </span>
            </div>
            <div className="phase-breakdown">
              <span className="breakdown-item">🔤 A-Z Words: {progress?.completedAZWords?.length || 0}/26</span>
              <span className="breakdown-item">📅 Days: {progress?.completedDays?.length || 0}/7</span>
              <span className="breakdown-item">🎨 Colors: {progress?.completedColors?.length || 0}/11</span>
              <span className="breakdown-item">🌍 General Words: {completedGeneralWords}/40</span>
            </div>
          </div>

          <div className="phase-progress-card">
            <div className="phase-header">
              <span className="phase-icon">🦁</span>
              <h3>Sentence Safari</h3>
            </div>
            <div className="phase-progress-bar-container">
              <div className="phase-progress-bar">
                <div
                  className="phase-progress-fill sentence"
                  style={{ width: `${Math.round((sentencesDone / sentenceTotal) * 100)}%` }}
                />
              </div>
              <span className="phase-progress-text">
                {sentencesDone} / {sentenceTotal} Complete
              </span>
            </div>
            {/* Quick action for Sentence Safari */}
            {/* Breakdown for Sentence Safari */}
            <div className="phase-breakdown">
              <span className="breakdown-item">🦁 Sentences: {sentencesDone}/{sentenceTotal}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Learning Path */}
      <motion.section
        className="learning-path"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="section-title">🎓 Your Learning Path</h2>

        <div className="path-stages">
          {/* Stage 1 - Sign Basics Adventure */}
          <motion.div
            className="stage-card beginner-stage available"
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/beginner-stage')}
          >
            <div className="stage-header">
              <span className="stage-icon">🌟</span>
              <div className="stage-badge">BEGINNER</div>
            </div>
            <h3>Sign Basics Adventure</h3>
            <p>Master alphabets A-Z and numbers 0-9</p>

            {/* Stage Image */}
            <div className="stage-image-container">
              <img src="/assets/stages/sign-basics.png" alt="Sign Basics Adventure" className="stage-hero-img" />
            </div>

            {/* Progress Bar */}
            <div className="stage-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round(((completedLetters + (progress?.completedNumbers?.length || 0)) / 36) * 100)}%` }}
                />
              </div>
              <span className="progress-text">
                {Math.round(((completedLetters + (progress?.completedNumbers?.length || 0)) / 36) * 100)}% Complete
              </span>
            </div>

            <button className="stage-button" onClick={() => navigate('/beginner-stage')}>
              {completedLetters + (progress?.completedNumbers?.length || 0) >= 36 ? '✅ Completed!' :
                completedLetters + (progress?.completedNumbers?.length || 0) > 0 ? '📖 Continue Learning' : '🚀 Start Learning'}
            </button>
          </motion.div>

          {/* Stage 2 - Word Wonderland */}
          <motion.div
            className={`stage-card intermediate-stage ${signBasicsCompleted ? 'available' : 'locked'}`}
            whileHover={signBasicsCompleted ? { scale: 1.02 } : {}}
            onClick={() => signBasicsCompleted && navigate('/intermediate-stage')}
          >
            <div className="stage-header">
              <span className={`stage-icon ${signBasicsCompleted ? '' : 'grayscale'}`}>🎨</span>
              <div className={`stage-badge ${signBasicsCompleted ? '' : 'locked'}`}>
                {signBasicsCompleted ? 'READY' : 'LOCKED'}
              </div>
            </div>
            <h3>Word Wonderland</h3>
            <p>Learn Alphabet Words, Days, Colours & General Words</p>

            {/* Stage Image */}
            <div className="stage-image-container">
              <img src="/assets/stages/word-wonderland.png" alt="Word Wonderland" className="stage-hero-img" />
            </div>

            <div className="stage-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill word"
                  style={{
                    width: `${Math.round((totalWordWonderland / 84) * 100)}%`
                  }}
                />
              </div>
              <span className="progress-text">
                {totalWordWonderland} / 84 Complete
              </span>
            </div>
            <button
              className={`stage-button ${signBasicsCompleted ? 'primary-btn' : 'locked-btn'}`}
              disabled={!signBasicsCompleted}
              onClick={() => {
                if (signBasicsCompleted) {
                  navigate('/intermediate-stage');
                }
              }}
            >
              {!signBasicsCompleted
                ? '🔒 Complete Sign Basics Adventure first'
                : totalWordWonderland >= 84
                  ? '✅ Completed!'
                  : '🎨 Enter Word Wonderland'}
            </button>
          </motion.div>

          {/* Stage 3 - Sentence Safari */}
          <motion.div className={`stage-card advanced-stage ${wordWonderlandComplete ? 'available' : 'locked'}`} whileHover={{ scale: wordWonderlandComplete ? 1.02 : 1 }} onClick={() => wordWonderlandComplete && navigate('/sentence-stage')}>
            {!wordWonderlandComplete && (
              <div className="lock-overlay">
                <div className="lock-icon">🔒</div>
              </div>
            )}
            <div className="stage-header">
              <span className={`stage-icon ${wordWonderlandComplete ? '' : 'grayscale'}`}>🦁</span>
              <div className={`stage-badge ${wordWonderlandComplete ? '' : 'locked'}`}>
                {wordWonderlandComplete ? 'READY' : 'LOCKED'}
              </div>
            </div>
            <h3>Sentence Safari</h3>
            <p>Say full ideas with your hands</p>

            {/* Stage Image */}
            <div className="stage-image-container">
              <img src="/assets/stages/sentence-safari.png" alt="Sentence Safari" className="stage-hero-img" />
            </div>

            <div className="stage-progress">
              <div className="progress-bar">
                <div className="progress-fill sentence" style={{ width: `${sentencePct}%` }} />
              </div>
              <span className="progress-text">{sentencesDone} / {sentenceTotal} sentences</span>
            </div>
            <button
              className={`stage-button ${wordWonderlandComplete ? 'primary-btn' : 'locked-btn'}`}
              disabled={!wordWonderlandComplete}
              onClick={() => wordWonderlandComplete && navigate('/sentence-stage')}
            >
              {!wordWonderlandComplete
                ? '🔒 Finish Word Wonderland first'
                : sentencesDone >= sentenceTotal
                  ? '✅ Completed!'
                  : '🦁 Start Sentence Safari'}
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Badges Section */}
      {/* How It Works */}
      <motion.section
        ref={howItWorksRef}
        className="how-it-works"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="section-title">How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <span className="step-icon">📹</span>
            <h4>Start Your Camera</h4>
            <p>Allow camera access to begin practicing</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <span className="step-icon">✋</span>
            <h4>Show the Sign</h4>
            <p>Follow the reference and make the hand sign</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <span className="step-icon">🎯</span>
            <h4>Get Real-time Feedback</h4>
            <p>See your accuracy and improve instantly</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <span className="step-icon">🏆</span>
            <h4>Earn Rewards</h4>
            <p>Collect badges as you progress</p>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      {/* Premium Footer */}
      <footer className="dashboard-footer-premium">
        <div className="footer-wave">
          <svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path fill="#ffffff" fillOpacity="1" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,85.3C672,75,768,85,864,112C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
          </svg>
        </div>

        <div className="footer-content">
          <div className="footer-column brand">
            <div className="footer-logo">
              <img src="/assets/avatar/mascot.png" alt="EduSign" />
              <h3>EduSign</h3>
            </div>
            <p className="brand-tagline">Building bridges through sign language. Learn, play, and connect! 🤝</p>
            <div className="social-links">
              <span className="social-icon">📷</span>
              <span className="social-icon">🐦</span>
              <span className="social-icon">📘</span>
              <span className="social-icon">▶️</span>
            </div>
          </div>

          <div className="footer-column links">
            <h4>Quick Links</h4>
            <div className="link-list">
              <button onClick={() => navigate('/profile')}>My Rewards & Profile</button>
              <button onClick={() => navigate('/intermediate-stage')}>Word Wonderland</button>
              <button onClick={() => {
                setShowHowItWorks(true);
                setTimeout(() => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}>How to Play</button>
              <button onClick={() => window.location.href = 'mailto:contact@edusign.app'}>Contact Support</button>
            </div>
          </div>

          <div className="footer-column fun">
            <h4>Daily Sign Fact 💡</h4>
            <div className="fact-card">
              <p>Did you know? Indian Sign Language (ISL) has its own unique grammar and is not just "English with hands"! It uses space and facial expressions too.</p>
            </div>
            <div className="footer-copyright">
              <span>© {new Date().getFullYear()} </span>
              <span className="heart">Made with ❤️ for Kids</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
