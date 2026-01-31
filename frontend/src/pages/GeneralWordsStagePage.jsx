import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/authService';
import userProgressService from '../services/userProgressService';
import '../styles/beginner-stage.css';

const GeneralWordsStagePage = () => {
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

    const completedGen1 = progress?.completedGen1?.length || 0;
    const gen1Progress = Math.round((completedGen1 / 24) * 100);

    const completedGen2 = progress?.completedGen2?.length || 0;
    const gen2Progress = Math.round((completedGen2 / 16) * 100);

    const isStage2Unlocked = true; // Temporary unlock for testing

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
                    <button className="nav-link back-to-dashboard" onClick={() => navigate('/intermediate-stage')}>
                        ← Back to Intermediate
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
                    🏝️ Action Island
                </h2>

                <div className="beginner-stages-grid">
                    {/* Motion Words Card */}
                    <motion.div
                        className="beginner-card available"
                        whileHover={{ y: -8 }}
                        onClick={() => navigate('/general-words-stage1')}
                    >
                        {/* Card Header */}
                        <div className="b-card-header">
                            <div className="b-icon-title">
                                <div className="b-icon">🌊</div>
                                <div className="b-title">
                                    <h3>Motion Words</h3>
                                </div>
                            </div>
                            <div className="b-badge">MOTION</div>
                        </div>

                        {/* Image Banner */}
                        <div className="b-image-container">
                            <motion.img
                                src="/assets/sections/motion-words.png"
                                alt="Motion Words"
                                className="b-hero-img"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                        </div>

                        {/* Card Body */}
                        <div className="b-card-body">
                            {/* Stat Pills */}
                            <div className="b-stats-pills">
                                <div className="b-stat-pill pill-blue">
                                    🌊 24 Words
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="b-progress-section">
                                <div className="b-progress-bar">
                                    <motion.div
                                        className="b-progress-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${gen1Progress}%` }}
                                        transition={{ duration: 1, delay: 0.3 }}
                                    />
                                </div>
                                <div className="b-progress-labels">
                                    <span>{completedGen1} Completed</span>
                                    <span>{24 - completedGen1} Remaining</span>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button className="b-cta-btn">
                                {completedGen1 > 0 ? '📖 Continue Learning' : '🚀 Start Adventure'}
                            </button>
                        </div>
                    </motion.div>

                    {/* Static Words Card */}
                    <motion.div
                        className={`beginner-card ${isStage2Unlocked ? 'available' : 'locked'}`}
                        whileHover={isStage2Unlocked ? { y: -8 } : {}}
                        onClick={() => isStage2Unlocked && navigate('/general-words-stage2')}
                    >
                        {/* Card Header */}
                        <div className="b-card-header">
                            <div className="b-icon-title">
                                <div className="b-icon">🤚</div>
                                <div className="b-title">
                                    <h3>Static Words</h3>
                                </div>
                            </div>
                            <div className="b-badge">STATIC</div>
                        </div>

                        {/* Image Banner */}
                        <div className="b-image-container">
                            <motion.img
                                src="/assets/sections/static-words.png"
                                alt="Static Words"
                                className="b-hero-img"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                            />
                        </div>

                        {/* Card Body */}
                        <div className="b-card-body">
                            {/* Stat Pills */}
                            <div className="b-stats-pills">
                                <div className="b-stat-pill pill-purple">
                                    🤚 16 Words
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="b-progress-section">
                                <div className="b-progress-bar">
                                    <motion.div
                                        className="b-progress-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${gen2Progress}%` }}
                                        transition={{ duration: 1, delay: 0.5 }}
                                    />
                                </div>
                                <div className="b-progress-labels">
                                    <span>{completedGen2} Completed</span>
                                    <span>{16 - completedGen2} Remaining</span>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button className="b-cta-btn">
                                {!isStage2Unlocked
                                    ? '🔒 Locked'
                                    : completedGen2 > 0
                                        ? '📖 Continue Learning'
                                        : '🚀 Start Adventure'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </motion.section>
        </div>
    );
};

export default GeneralWordsStagePage;
