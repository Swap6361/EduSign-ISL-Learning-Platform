import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import '../styles/dashboard.css'; // Utilizing existing styles or creating new ones inline

const CelebrationModal = ({ badge, onClose }) => {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!badge) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="celebration-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)', // Darker overlay for focus
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999, // Highest z-index
                    backdropFilter: 'blur(5px)'
                }}
            >
                {/* Confetti */}
                <Confetti
                    width={windowSize.width}
                    height={windowSize.height}
                    numberOfPieces={200}
                    recycle={false} // Run once
                />

                <motion.div
                    className="celebration-card"
                    initial={{ scale: 0.5, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    style={{
                        background: 'white',
                        padding: '40px',
                        borderRadius: '24px',
                        textAlign: 'center',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        position: 'relative'
                    }}
                >
                    <div style={{ marginBottom: '24px' }}>
                        <motion.div
                            animate={{
                                rotate: [0, -10, 10, -10, 10, 0],
                                scale: [1, 1.1, 1, 1.1, 1]
                            }}
                            transition={{ duration: 1, delay: 0.2 }}
                        >
                            {/* Check if icon is a path or emoji */}
                            {badge.icon && (badge.icon.startsWith('/') || badge.icon.startsWith('http')) ? (
                                <img
                                    src={badge.icon}
                                    alt={badge.name}
                                    onError={(e) => {
                                        e.target.style.display = 'none'; // Hide broken image
                                        e.target.nextSibling.style.display = 'block'; // Show fallback
                                    }}
                                    style={{
                                        width: '150px',
                                        height: '150px',
                                        objectFit: 'contain',
                                        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))',
                                        display: 'block',
                                        margin: '0 auto'
                                    }}
                                />
                            ) : (
                                <div style={{ fontSize: '8rem', lineHeight: 1 }}>
                                    {badge.icon || '🏆'}
                                </div>
                            )}
                            {/* Fallback for broken images (hidden by default) */}
                            <div style={{ display: 'none', fontSize: '8rem', lineHeight: 1 }}>🏆</div>
                        </motion.div>
                    </div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            fontSize: '2rem',
                            color: '#2D3748',
                            marginBottom: '10px',
                            background: badge.id === 'sign_language_legend' ? 'linear-gradient(90deg, #FFD700, #FFA500)' : 'linear-gradient(90deg, #F6AD55, #ED8936)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: '800'
                        }}
                    >
                        {badge.id === 'sign_language_legend' ? 'LEGENDARY!' : 'Fantastic!'}
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        style={{ fontSize: '1.2rem', color: '#4A5568', marginBottom: '8px' }}
                    >
                        You unlocked a new badge:
                    </motion.p>

                    <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        style={{
                            fontSize: '1.5rem',
                            color: '#2D3748',
                            marginBottom: '30px',
                            fontWeight: 'bold'
                        }}
                    >
                        {badge.name}
                    </motion.h3>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onClose}
                        style={{
                            background: 'linear-gradient(90deg, #ed8936 0%, #dd6b20 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '16px 40px',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(237, 137, 54, 0.4)'
                        }}
                    >
                        Keep Learning!
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CelebrationModal;
