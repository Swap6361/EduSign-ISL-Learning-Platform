import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import { getAllBadges } from '../config/badges';
import '../styles/profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState('mascot');
  const [loading, setLoading] = useState(true);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const profileData = await userProgressService.getProgress(currentUser.uid);
      setProfile(profileData);

      // Auto-select best avatar
      if ((profileData?.completedLetters?.length || 0) >= 26) setSelectedAvatar('mascot_hat');
      if ((profileData?.completedAZWords?.length || 0) >= 5) setSelectedAvatar('mascot_hat_glasses');
      if ((profileData?.completedSentences?.length || 0) >= 7) setSelectedAvatar('mascot_golden_shoes');

      // Check for Sign Language Legend and set crown
      if (profileData?.badges?.includes('Sign Language Legend')) {
        setSelectedAvatar('mascot_legend');
      }
    }
    setLoading(false);
  };

  // Detect grand finale entry and trigger sparkles
  useEffect(() => {
    if (location.state?.grandFinale) {
      setShowSparkles(true);
      // Clear state to prevent retriggering
      window.history.replaceState({}, document.title);

      // Auto-hide sparkles after 5 seconds
      setTimeout(() => setShowSparkles(false), 5000);
    }
  }, [location]);

  const handleLogout = async () => {
    const result = await authService.logout();
    if (result.success) navigate('/login');
  };

  // --- Avatars Config ---
  const avatarConfig = [
    {
      id: 'mascot_hat',
      name: '🎩 Hat Avatar',
      condition: 'Start your journey!',
      unlocked: true // DEFAULT UNLOCKED FOR BEGINNERS
    },
    {
      id: 'mascot_hat_glasses', // WAS: mascot_glasses
      name: '👓 Smarty Avatar', // "Hat + Glasses"
      condition: 'Complete Sign Basics Adventure (Alphabet & Numbers)',
      unlocked: (profile?.completedLetters?.length || 0) >= 26 &&
        (profile?.completedNumbers?.length || 0) >= 10
    },
    {
      id: 'mascot_golden_shoes', // WAS: mascot_mood / mascot_glasses
      name: '👟 Golden Shoes',
      condition: 'Complete Word Wonderland (All 84 Words)',
      unlocked: (
        (profile?.completedAZWords?.length || 0) +
        (profile?.completedDays?.length || 0) +
        (profile?.completedColors?.length || 0) +
        (profile?.completedGen1?.length || 0) +
        (profile?.completedGen2?.length || 0)
      ) >= 84
    },
    // Final Legend Avatar
    {
      id: 'mascot_legend',
      name: '👑 Legend Crown',
      condition: 'Unlock Sign Language Legend Trophy',
      unlocked: profile?.badges?.includes('Sign Language Legend')
    }
  ];

  const getAppLevel = () => {
    if (profile?.badges?.includes('Sign Language Legend')) return 'Legend';
    const total = (profile?.completedLetters?.length || 0) +
      (profile?.completedAZWords?.length || 0);
    if (total > 50) return 'Advanced';
    if (total > 20) return 'Intermediate';
    return 'Beginner';
  };

  const allBadges = getAllBadges(); // Get all badges from config
  const isLegend = profile?.badges?.includes('Sign Language Legend');

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <>
      {/* Sparkle Overlay for Grand Finale entrance */}
      <AnimatePresence>
        {showSparkles && (
          <motion.div
            className="profile-sparkle-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="sparkle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="profile-page">
        {/* Header */}
        <div className="profile-header">
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h1>My Profile</h1>
          <button className="back-button" style={{ color: '#dc2626' }} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="profile-container">

          {/* FINAL GRAND ACHIEVEMENT SECTION */}
          <motion.div
            className={`profile-card-main ${isLegend ? 'legend-glow' : ''}`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {isLegend && (
              <div className="legend-badge-display">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: 360 }}
                  transition={{ type: 'spring', delay: 0.5 }}
                  style={{ marginBottom: '20px' }}
                >
                  <img src="/assets/badges/trophy_legend.png" alt="Legend Trophy" style={{ width: '120px', height: '120px', filter: 'drop-shadow(0 0 15px gold)' }} />
                </motion.div>
                <h2 style={{ background: 'linear-gradient(90deg, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '2rem', fontWeight: '900' }}>Sign Language Legend</h2>
                <p style={{ color: '#d69e2e', fontWeight: 'bold' }}>Completed all EduSign Adventures</p>
                <div style={{ width: '100%', height: '2px', background: '#edf2f7', margin: '20px 0' }}></div>
              </div>
            )}

            <div className="profile-card-gradient">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedAvatar}
                  className="profile-avatar-large"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <img src={`/assets/avatar/${selectedAvatar}.png`} alt="Avatar" />
                </motion.div>
              </AnimatePresence>

              <div className="profile-mascot-small">
                <img src="/assets/avatar/mascot_excited.png" alt="Mascot" />
              </div>
            </div>

            <h2>{user?.displayName || 'Learner'}</h2>
            <p style={{ color: '#718096', marginBottom: '16px' }}>{user?.email}</p>
            <div className={`learning-level-badge ${getAppLevel().toLowerCase()}`}>
              {getAppLevel()}
            </div>
          </motion.div>

          {/* Avatar Collection */}
          <motion.section
            className="profile-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h3>🎭 Your Avatars</h3>
            <div className="avatar-grid">
              {avatarConfig.map((avatar) => (
                <div
                  key={avatar.id}
                  className={`avatar-item ${avatar.unlocked ? 'unlocked' : 'locked'} ${selectedAvatar === avatar.id ? 'selected' : ''}`}
                  onClick={() => avatar.unlocked && setSelectedAvatar(avatar.id)}
                >
                  <div className="avatar-image-container">
                    <img
                      src={`/assets/avatar/${avatar.id}.png`}
                      alt={avatar.name}
                      className={!avatar.unlocked ? 'grayscale' : ''}
                    />
                    {!avatar.unlocked && (
                      <div className="lock-overlay">
                        <span className="lock-icon">🔒</span>
                      </div>
                    )}
                  </div>
                  <p className="avatar-name">{avatar.name}</p>
                  {!avatar.unlocked && <p className="unlock-condition">{avatar.condition}</p>}
                </div>
              ))}
            </div>
          </motion.section>

          {/* Star Collection - Sign Basics Breakdown */}
          <motion.section
            className="profile-section stars-breakdown-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🌟</span>
              <h3>Star Collection - Sign Basics</h3>
            </div>

            <div className="star-breakdown-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="star-category-card">
                <div className="cat-icon-box blue-bg">
                  <span className="cat-icon">🔤</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedLetters?.length || 0}/26</span>
                  <span className="cat-label">Alphabet</span>
                </div>
              </div>

              <div className="star-category-card">
                <div className="cat-icon-box green-bg">
                  <span className="cat-icon">🔢</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedNumbers?.length || 0}/10</span>
                  <span className="cat-label">Numbers</span>
                </div>
              </div>
            </div>

            <div className="total-stars-bar" style={{ background: 'linear-gradient(90deg, #4299e1 0%, #63b3ed 100%)', boxShadow: '0 4px 12px rgba(66, 153, 225, 0.3)' }}>
              <span className="big-star">⭐</span>
              <div className="total-count-text">
                <span className="big-number">
                  {
                    (profile?.completedLetters?.length || 0) +
                    (profile?.completedNumbers?.length || 0)
                  } / 36
                </span>
                <span className="total-label">Basics Stars Collected</span>
              </div>
            </div>
          </motion.section>

          {/* Star Collection - Word Wonderland Breakdown */}
          <motion.section
            className="profile-section stars-breakdown-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🌈</span>
              <h3>Star Collection - Word Wonderland</h3>
            </div>

            <div className="star-breakdown-grid">
              <div className="star-category-card">
                <div className="cat-icon-box orange-bg">
                  <span className="cat-icon">🔤</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedAZWords?.length || 0}/26</span>
                  <span className="cat-label">A-Z Words</span>
                </div>
              </div>

              <div className="star-category-card">
                <div className="cat-icon-box pink-bg">
                  <span className="cat-icon">📅</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedDays?.length || 0}/7</span>
                  <span className="cat-label">Days</span>
                </div>
              </div>

              <div className="star-category-card">
                <div className="cat-icon-box purple-bg">
                  <span className="cat-icon">🎨</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedColors?.length || 0}/11</span>
                  <span className="cat-label">Colors</span>
                </div>
              </div>

              <div className="star-category-card">
                <div className="cat-icon-box teal-bg">
                  <span className="cat-icon">🌍</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{(profile?.completedGen1?.length || 0) + (profile?.completedGen2?.length || 0)}/40</span>
                  <span className="cat-label">General</span>
                </div>
              </div>
            </div>

            <div className="total-stars-bar" style={{ background: 'linear-gradient(90deg, #ed64a6 0%, #d53f8c 100%)', boxShadow: '0 4px 12px rgba(213, 63, 140, 0.3)' }}>
              <span className="big-star">🌟</span>
              <div className="total-count-text">
                <span className="big-number">
                  {
                    (profile?.completedAZWords?.length || 0) +
                    (profile?.completedDays?.length || 0) +
                    (profile?.completedColors?.length || 0) +
                    (profile?.completedGen1?.length || 0) +
                    (profile?.completedGen2?.length || 0)
                  } / 84
                </span>
                <span className="total-label">Wonderland Stars Collected</span>
              </div>
            </div>
          </motion.section>

          {/* Star Collection - Sentence Safari Breakdown */}
          <motion.section
            className="profile-section stars-breakdown-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🦁</span>
              <h3>Star Collection - Sentence Safari</h3>
            </div>

            <div className="star-breakdown-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="star-category-card">
                <div className="cat-icon-box orange-bg">
                  <span className="cat-icon">💬</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{profile?.completedSentences?.length || 0}/7</span>
                  <span className="cat-label">Sentences</span>
                </div>
              </div>

              <div className="star-category-card">
                <div className="cat-icon-box yellow-bg">
                  <span className="cat-icon">✨</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-count">{(profile?.completedSentences?.length || 0) >= 7 ? 'Master' : 'Learner'}</span>
                  <span className="cat-label">Status</span>
                </div>
              </div>
            </div>

            <div className="total-stars-bar" style={{ background: 'linear-gradient(90deg, #ed8936 0%, #f6ad55 100%)', boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)' }}>
              <span className="big-star">⭐</span>
              <div className="total-count-text">
                <span className="big-number">
                  {profile?.completedSentences?.length || 0} / 7
                </span>
                <span className="total-label">Safari Stars Collected</span>
              </div>
            </div>
          </motion.section>

          {/* Badges Grid - Sign Basics Adventure */}
          <motion.section
            className="profile-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🌴</span>
              <h3>Sign Basics Adventure Badges</h3>
            </div>
            <div className="badges-grid">
              {allBadges.filter(b => b.category === 'sign_basics').map((badge) => {
                const isUnlocked = badge.condition(profile);
                return (
                  <motion.div
                    key={badge.id}
                    className={`badge-item ${isUnlocked ? 'unlocked' : 'locked'}`}
                    whileHover={isUnlocked ? { scale: 1.05 } : {}}
                  >
                    <div className="badge-image-container">
                      <img
                        src={badge.icon}
                        alt={badge.name}
                        className={!isUnlocked ? 'grayscale' : ''}
                      />
                      {!isUnlocked && (
                        <div className="badge-lock-overlay">
                          <span className="badge-lock-icon">🔒</span>
                        </div>
                      )}
                    </div>
                    <p className="badge-title">{badge.name}</p>
                    <p className="badge-description">{badge.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Badges Grid - Word Wonderland */}
          <motion.section
            className="profile-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🌈</span>
              <h3>Word Wonderland Badges</h3>
            </div>
            <div className="badges-grid">
              {allBadges.filter(b => b.category === 'word_wonderland').map((badge) => {
                const isUnlocked = badge.condition(profile);
                return (
                  <motion.div
                    key={badge.id}
                    className={`badge-item ${isUnlocked ? 'unlocked' : 'locked'}`}
                    whileHover={isUnlocked ? { scale: 1.05 } : {}}
                  >
                    <div className="badge-image-container">
                      <img
                        src={badge.icon}
                        alt={badge.name}
                        className={!isUnlocked ? 'grayscale' : ''}
                      />
                      {!isUnlocked && (
                        <div className="badge-lock-overlay">
                          <span className="badge-lock-icon">🔒</span>
                        </div>
                      )}
                    </div>
                    <p className="badge-title">{badge.name}</p>
                    <p className="badge-description">{badge.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Badges Grid - Sentence Safari */}
          <motion.section
            className="profile-section"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="section-header-stars">
              <span className="star-header-icon">🦁</span>
              <h3>Sentence Safari Badges</h3>
            </div>
            <div className="badges-grid">
              {allBadges.filter(b => b.category === 'sentence_safari').map((badge) => {
                const isUnlocked = badge.condition(profile);
                return (
                  <motion.div
                    key={badge.id}
                    className={`badge-item ${isUnlocked ? 'unlocked' : 'locked'}`}
                    whileHover={isUnlocked ? { scale: 1.05 } : {}}
                  >
                    <div className="badge-image-container">
                      <img
                        src={badge.icon}
                        alt={badge.name}
                        className={!isUnlocked ? 'grayscale' : ''}
                      />
                      {!isUnlocked && (
                        <div className="badge-lock-overlay">
                          <span className="badge-lock-icon">🔒</span>
                        </div>
                      )}
                    </div>
                    <p className="badge-title">{badge.name}</p>
                    <p className="badge-description">{badge.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default Profile;