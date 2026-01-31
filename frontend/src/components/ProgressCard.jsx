import React, { useState } from 'react';
import { motion } from 'framer-motion';
import CircularProgress from './CircularProgress';
import StarCounter from './StarCounter';

const ProgressCard = ({
    title = 'Stage',
    subtitle = '',
    progress = 0,
    total = 100,
    stars = 0,
    maxStars = 5,
    locked = false,
    completed = false,
    icon = '🎯',
    onClick,
    className = ''
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            className={`relative overflow-hidden rounded-3xl bg-white shadow-xl transition-all ${locked ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${className}`}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={!locked ? {
                scale: 1.05,
                y: -8,
                boxShadow: '0 20px 40px rgba(255, 140, 66, 0.2)'
            } : {}}
            whileTap={!locked ? { scale: 0.98 } : {}}
            onClick={!locked ? onClick : undefined}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
        >
            {/* Locked Overlay */}
            {locked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900/20 backdrop-blur-sm"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-6xl"
                    >
                        🔒
                    </motion.div>
                    <p className="mt-2 text-sm font-semibold text-gray-700">Locked</p>
                </motion.div>
            )}

            {/* Card Content */}
            <div className={`p-6 ${locked ? 'blur-sm' : ''}`}>
                {/* Icon & Title */}
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <motion.div
                            className="text-4xl mb-2"
                            animate={isHovered && !locked ? {
                                rotate: [0, -10, 10, 0],
                                scale: [1, 1.1, 1]
                            } : {}}
                            transition={{ duration: 0.5 }}
                        >
                            {icon}
                        </motion.div>
                        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                        {subtitle && (
                            <p className="text-sm text-gray-500">{subtitle}</p>
                        )}
                    </div>

                    {/* Completion Badge */}
                    {completed && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="rounded-full bg-green-500 p-2 text-white shadow-lg"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </motion.div>
                    )}
                </div>

                {/* Progress Ring */}
                <div className="mb-4 flex justify-center">
                    <CircularProgress
                        value={progress}
                        max={total}
                        color={completed ? '#10b981' : '#FF8C42'}
                    />
                </div>

                {/* Star Counter */}
                {maxStars > 0 && (
                    <div className="flex justify-center">
                        <StarCounter count={stars} total={maxStars} size="sm" />
                    </div>
                )}

                {/* Hover Glow Effect */}
                {isHovered && !locked && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-r from-orange-200 to-yellow-200 blur-xl"
                    />
                )}
            </div>

            {/* Confetti Burst on Completion */}
            {completed && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 2 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                    <div className="text-6xl">🎉</div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default ProgressCard;
