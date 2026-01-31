import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import '../styles/beginner-stage.css';

const SentenceStagePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            loadProgress(currentUser.uid);
        }
    }, []);

    const loadProgress = async (uid) => {
        const userProgress = await userProgressService.getProgress(uid);
        setProgress(userProgress || {});
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

    const completedSentences = progress?.completedSentences?.length || 0;
    const totalSentences = 7;
    const sentenceProgress = Math.round((completedSentences / totalSentences) * 100);

    const sentences = [
        "Good morning, everyone",
        "How are you _",
        "I am fine",
        "I am studying indian sign language",
        "My Name is",
        "What are you doing _",
        "What is your name _"
    ];

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
                </div>
            </motion.header>

            {/* Main Content */}
            <motion.section
                className="learning-path"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="section-title" style={{ marginTop: '0', textAlign: 'center', fontSize: '2rem' }}>
                    🦁 Your Sentence Journey
                </h2>

                <div className="beginner-stages-grid" style={{ maxWidth: '600px' }}>
                    {/* Sentence Recognition Card */}
                    <motion.div
                        className="beginner-card available"
                        whileHover={{ y: -8 }}
                        onClick={() => navigate('/sentence-lesson')}
                    >
                        {/* Card Header */}
                        <div className="b-card-header">
                            <div className="b-icon-title">
                                <div className="b-icon">📝</div>
                                <div className="b-title">
                                    <h3>Sentence Recognition</h3>
                                </div>
                            </div>
                            <div className="b-badge">ADVANCED</div>
                        </div>

                        {/* Image Banner */}
                        <div className="b-image-container">
                            <motion.img
                                src="/assets/sections/sentence-safari.png"
                                alt="Sentence Safari"
                                className="b-hero-img"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                        </div>

                        {/* Card Body */}
                        <div className="b-card-body">
                            {/* Stat Pills */}
                            <div className="b-stats-pills">
                                <div className="b-stat-pill pill-purple">
                                    🦁 7 Sentences
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="b-progress-section">
                                <div className="b-progress-bar">
                                    <motion.div
                                        className="b-progress-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${sentenceProgress}%` }}
                                        transition={{ duration: 1, delay: 0.3 }}
                                    />
                                </div>
                                <div className="b-progress-labels">
                                    <span>{completedSentences} Completed</span>
                                    <span>{totalSentences - completedSentences} Remaining</span>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button className="b-cta-btn">
                                {completedSentences > 0 ? '📖 Continue Learning' : '🚀 Start Safari'}
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Sentence List Preview Removed */}
            </motion.section>
        </div>
    );
};

export default SentenceStagePage;
