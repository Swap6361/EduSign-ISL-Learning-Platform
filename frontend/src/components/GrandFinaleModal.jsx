import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import '../styles/grand-finale.css';

const GrandFinaleModal = ({ isOpen, onClose, userName }) => {
    const navigate = useNavigate();
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="grand-finale-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Confetti Shower */}
                <Confetti
                    width={windowSize.width}
                    height={windowSize.height}
                    numberOfPieces={500}
                    recycle={true}
                    colors={['#FFD700', '#FFA500', '#FF6B9D', '#06FFA5', '#9c8ae0']}
                />

                <motion.div
                    className="grand-finale-content"
                    initial={{ scale: 0.5, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', duration: 0.8, bounce: 0.4 }}
                >
                    {/* Animated Mascot */}
                    <motion.img
                        src="/assets/avatar/mascot_final.png"
                        alt="Celebration Mascot"
                        className="finale-mascot"
                        animate={{
                            y: [0, -20, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            ease: 'easeInOut'
                        }}
                    />

                    {/* Pulsing Trophy */}
                    <motion.div
                        className="finale-trophy"
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0]
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                    >
                        🏆
                    </motion.div>

                    {/* Congratulatory Text */}
                    <motion.h1
                        className="finale-title"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        🎉 Congratulations{userName ? `, ${userName}` : ''}!
                    </motion.h1>

                    <motion.h2
                        className="finale-subtitle"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        You've Mastered Indian Sign Language!
                    </motion.h2>

                    <motion.p
                        className="finale-message"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.7 }}
                    >
                        You are now an <strong>ISL Expert</strong> and can communicate with confidence!
                        <br />
                        You've earned the prestigious <strong>Sign Language Legend</strong> trophy! 🏅
                    </motion.p>

                    {/* Achievement Badge */}
                    <motion.div
                        className="finale-achievement"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                    >
                        <div className="achievement-icon">👑</div>
                        <div className="achievement-text">
                            <strong>Sign Language Legend</strong>
                            <p>All Adventures Completed</p>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        className="finale-buttons"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.2 }}
                    >
                        <motion.button
                            className="btn-primary finale-btn-primary"
                            onClick={() => navigate('/profile', { state: { grandFinale: true } })}
                            whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(255, 215, 0, 0.4)' }}
                            whileTap={{ scale: 0.95 }}
                        >
                            ✨ View Your Achievements
                        </motion.button>
                        <motion.button
                            className="btn-secondary finale-btn-secondary"
                            onClick={() => navigate('/dashboard')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Return to Dashboard
                        </motion.button>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GrandFinaleModal;
