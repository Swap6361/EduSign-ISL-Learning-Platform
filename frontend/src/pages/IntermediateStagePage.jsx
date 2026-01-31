import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import WordSectionCard from '../components/WordSectionCard';
import '../styles/intermediate-stage.css';

const IntermediateStagePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Force-unlock toggle for QA/testing.
  const FORCE_UNLOCK_SECTIONS = true;

  useEffect(() => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        loadProgress(currentUser.uid);
      } else {
        setError('No user found');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const loadProgress = async (uid) => {
    try {
      const userProgress = await userProgressService.getProgress(uid);
      setProgress(userProgress || {});
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading progress:', err);
      setError(err.message);
      setProgress({});
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div className="loading-screen"><p>Error: {error}</p></div>;

  // Progress Tracking
  const completedAZWords = progress?.completedAZWords?.length || 0;
  const completedDays = progress?.completedDays?.length || 0;
  const completedColors = progress?.completedColors?.length || 0;
  const completedGeneralWords = (progress?.completedGen1?.length || 0) + (progress?.completedGen2?.length || 0);

  const totalWordsCompleted = completedAZWords + completedDays + completedColors + completedGeneralWords;
  const completedLetters = progress?.completedLetters?.length || 0;
  const completedNumbers = progress?.completedNumbers?.length || 0;
  const signBasicsCompleted = Boolean(
    progress?.signBasicsCompleted || (completedLetters >= 26 && completedNumbers >= 10)
  );

  const sections = [
    {
      id: 'az-words',
      title: 'A–Z Words',
      icon: '🔤',
      image: '/assets/sections/alphabet-island.png',
      completed: completedAZWords,
      total: 26,
      unlocked: FORCE_UNLOCK_SECTIONS || signBasicsCompleted,
      path: '/a-z-words-lesson',
      pillText: '26 Words',
      pillColor: 'pill-green',
      blobColor1: '#a7f3d0',
      blobColor2: '#10b981'
    },
    {
      id: 'days',
      title: 'Days of the Week',
      icon: '📅',
      image: '/assets/sections/days.png',
      completed: completedDays,
      total: 7,
      unlocked: FORCE_UNLOCK_SECTIONS || (completedAZWords >= 26),
      path: '/days-lesson',
      pillText: '7 Days',
      pillColor: 'pill-blue',
      blobColor1: '#bfdbfe',
      blobColor2: '#3b82f6'
    },
    {
      id: 'colours',
      title: 'Colours',
      icon: '🎨',
      image: '/assets/sections/colors.png',
      completed: completedColors,
      total: 11,
      unlocked: FORCE_UNLOCK_SECTIONS || (completedDays >= 7),
      path: '/colors-lesson',
      pillText: '11 Colours',
      pillColor: 'pill-purple',
      blobColor1: '#e9d5ff',
      blobColor2: '#a855f7'
    },
    {
      id: 'general',
      title: 'General Words',
      icon: '💬',
      image: '/assets/sections/general.png',
      completed: completedGeneralWords,
      total: 40,
      unlocked: FORCE_UNLOCK_SECTIONS || (completedColors >= 11),
      path: '/general-words',
      pillText: '40 Words',
      pillColor: 'pill-orange',
      blobColor1: '#fed7aa',
      blobColor2: '#f97316'
    }
  ];

  const completedSentences = progress?.completedSentences?.length || 0;
  const totalSentences = 7;
  // Sentence Safari unlocks after 84 words
  const sentenceSafariUnlocked = totalWordsCompleted >= 84;

  return (
    <div className="intermediate-stage-page">
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
          <span className="user-greeting">Hi, {user?.displayName || 'Learner'}! 👋</span>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.section
        className="learning-path"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="section-title">🗺️ Word Wonderland</h2>

        <div className="intermediate-grid">
          {sections.map((section) => (
            <WordSectionCard
              key={section.id}
              title={section.title}
              icon={section.icon}
              image={section.image}
              completed={section.completed}
              total={section.total}
              locked={!section.unlocked}
              pillText={section.pillText}
              pillColor={section.pillColor}
              blobColor1={section.blobColor1}
              blobColor2={section.blobColor2}
              onClick={() => navigate(section.path)}
            />
          ))}



        </div>
      </motion.section>
    </div>
  );
};

export default IntermediateStagePage;
