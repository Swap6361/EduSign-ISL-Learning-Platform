import React from 'react';
import { motion } from 'framer-motion';
import CircularProgress from './CircularProgress';

const StageCard = ({
    id,
    title = 'Stage',
    description = '',
    image = '',
    progress = 0,
    total = 100,
    locked = false,
    completed = false,
    reward = '',
    isActive = false,
    onClick
}) => {
    return (
        <motion.div
            className={`relative mx-auto h-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-white to-orange-50 shadow-2xl transition-all ${locked ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
            initial={{ opacity: 0.8, scale: 0.95 }}
            animate={{
                opacity: isActive ? 1 : 0.8,
                scale: isActive ? 1 : 0.95,
                boxShadow: isActive
                    ? '0 25px 50px rgba(255, 140, 66, 0.3)'
                    : '0 10px 30px rgba(0, 0, 0, 0.1)'
            }}
            whileHover={!locked ? {
                scale: 1.02,
                y: -10
            } : {}}
            whileTap={!locked ? { scale: 0.98 } : {}}
            onClick={onClick}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
            {/* Locked Overlay */}
            {locked && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/30 backdrop-blur-md">
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, -5, 5, 0]
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-7xl"
                    >
                        🔒
                    </motion.div>
                    <p className="mt-3 text-lg font-bold text-white drop-shadow-lg">
                        Complete previous stages
                    </p>
                </div>
            )}

            {/* Card Content */}
            <div className={`relative flex h-full flex-col ${locked ? 'blur-sm' : ''}`}>
                {/* Image Section */}
                {image && (
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-orange-200 to-yellow-200">
                        <img
                            src={image}
                            alt={title}
                            className="h-full w-full object-cover"
                        />
                        {completed && (
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="absolute right-4 top-4 rounded-full bg-green-500 p-3 text-white shadow-xl"
                            >
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Content Section */}
                <div className="flex flex-1 flex-col p-6">
                    <h3 className="mb-2 text-2xl font-bold text-gray-800">{title}</h3>
                    <p className="mb-4 flex-1 text-sm text-gray-600">{description}</p>

                    {/* Progress Section */}
                    <div className="mb-4 flex items-center justify-between">
                        <CircularProgress
                            value={progress}
                            max={total}
                            size={80}
                            strokeWidth={6}
                            color={completed ? '#10b981' : '#FF8C42'}
                        />
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Progress</p>
                            <p className="text-lg font-bold text-gray-800">
                                {progress}/{total}
                            </p>
                        </div>
                    </div>

                    {/* Reward Badge */}
                    {reward && !locked && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl bg-yellow-100 p-3 text-center"
                        >
                            <p className="text-xs text-gray-600">Reward</p>
                            <p className="text-sm font-bold text-yellow-700">{reward}</p>
                        </motion.div>
                    )}

                    {/* CTA Button */}
                    {!locked && !completed && (
                        <motion.button
                            className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 py-3 font-bold text-white shadow-lg"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {progress > 0 ? 'Continue Learning' : 'Start Adventure'}
                        </motion.button>
                    )}

                    {completed && (
                        <motion.button
                            className="mt-4 w-full rounded-xl border-2 border-green-500 bg-green-50 py-3 font-bold text-green-700"
                            whileHover={{ scale: 1.05, backgroundColor: '#dcfce7' }}
                            whileTap={{ scale: 0.95 }}
                        >
                            ✓ Completed - Review
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Active Indicator Glow */}
            {isActive && !locked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-r from-orange-400 to-yellow-400 blur-2xl"
                />
            )}
        </motion.div>
    );
};

export default StageCard;
