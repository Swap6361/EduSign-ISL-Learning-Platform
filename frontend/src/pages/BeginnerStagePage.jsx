import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import '../styles/beginner-stage.css';

const BeginnerStagePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [progress, setProgress] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadProgress(currentUser.uid);
    }
  }, []);

  const loadProgress = async (uid) => {
    const userProgress = await userProgressService.getProgress(uid);
    setProgress(userProgress);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your progress...</p>
      </div>
    );
  }

  const completedLetters = progress?.completedLetters?.length || 0;
  const alphabetProgress = Math.round((completedLetters / 26) * 100);
  const completedNumbers = progress?.completedNumbers?.length || 0;
  const numbersProgress = Math.round((completedNumbers / 10) * 100);

  return (
    <div className="beginner-stage-page">
      {/* Header */}
      <motion.header
        className="dashboard-header"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="logo" onClick={() => navigate('/dashboard')}>
          <img src="/assets/avatar/mascot.png" alt="EduSign" className="logo-icon" />
          <h1>EduSign</h1>
        </div>
        <nav className="header-nav">
          <button className="nav-link back-to-dashboard" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
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


      {/* Main Content */}
      <motion.section
        className="learning-path"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="section-title" style={{ marginTop: '0', textAlign: 'center', fontSize: '2rem' }}>🎓 Choose Your Learning Path</h2>

        <div className="beginner-stages-grid">

          {/* Alphabet Island Card */}
          <motion.div
            className="beginner-card available"
            whileHover={{ y: -8 }}
            onClick={() => navigate('/lesson', { state: { stage: 'Alphabet Island', type: 'alphabet' } })}
          >
            {/* Header */}
            <div className="b-card-header">
              <div className="b-icon-title">
                <span className="b-icon">🏝️</span>
                <div className="b-title">
                  <h3>Alphabet Island</h3>
                </div>
              </div>
              <div className="b-badge">ALPHABET</div>
            </div>

            {/* Image Banner */}
            <div className="b-image-container">
              <motion.img
                src="/assets/sections/alphabet-island.png"
                alt="Alphabet Island"
                className="b-hero-img"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* Body */}
            <div className="b-card-body">
              {/* Stat Pills */}
              <div className="b-stats-pills">
                <div className="b-stat-pill pill-green">
                  <span>🏝️</span>
                  <span>26 Letters</span>
                </div>
                <div className="b-stat-pill">
                  <span>⭐</span>
                  <span>A-Z Master</span>
                </div>
              </div>

              {/* Progress */}
              <div className="b-progress-section">
                <div className="b-progress-bar">
                  <motion.div
                    className="b-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${alphabetProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <div className="b-progress-labels">
                  <span>{completedLetters} Completed</span>
                  <span>{26 - completedLetters} Remaining</span>
                </div>
              </div>

              {/* CTA */}
              <button className="b-cta-btn">
                {completedLetters > 0 ? '📖 Continue Learning' : '🚀 Start Adventure'}
              </button>
            </div>
          </motion.div>


          {/* Number Game Card */}
          <motion.div
            className="beginner-card available"
            whileHover={{ y: -8 }}
            onClick={() => navigate('/number-lesson', { state: { stage: 'Number Game', type: 'numbers' } })}
          >
            {/* Header */}
            <div className="b-card-header">
              <div className="b-icon-title">
                <span className="b-icon">🔢</span>
                <div className="b-title">
                  <h3>Number Game</h3>
                </div>
              </div>
              <div className="b-badge">NUMBERS</div>
            </div>

            {/* Image Banner */}
            <div className="b-image-container">
              <motion.img
                src="/assets/sections/number-game.png"
                alt="Number Game"
                className="b-hero-img"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              />
            </div>

            {/* Body */}
            <div className="b-card-body">
              {/* Stat Pills */}
              <div className="b-stats-pills">
                <div className="b-stat-pill pill-blue">
                  <span>🔢</span>
                  <span>10 Numbers</span>
                </div>
                <div className="b-stat-pill">
                  <span>🏆</span>
                  <span>Count 0-9</span>
                </div>
              </div>

              {/* Progress */}
              <div className="b-progress-section">
                <div className="b-progress-bar">
                  <motion.div
                    className="b-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${numbersProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <div className="b-progress-labels">
                  <span>{completedNumbers} Completed</span>
                  <span>{10 - completedNumbers} Remaining</span>
                </div>
              </div>

              {/* CTA */}
              <button className="b-cta-btn">
                {completedNumbers > 0 ? '📖 Continue Learning' : '🚀 Start Adventure'}
              </button>
            </div>
          </motion.div>

        </div>
      </motion.section>
    </div>
  );
};

export default BeginnerStagePage;

