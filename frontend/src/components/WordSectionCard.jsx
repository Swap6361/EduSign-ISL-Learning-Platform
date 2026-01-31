import React from 'react';
import { motion } from 'framer-motion';

const WordSectionCard = ({
    title,
    icon,
    image,
    progress = 0,
    total = 0,
    completed = 0,
    pillText,
    pillColor = 'pill-purple',
    locked = false,
    onClick,
    blobColor1 = '#FFD166',
    blobColor2 = '#FF8C42'
}) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <motion.div
            className={`word-section-card ${locked ? 'locked' : 'available'}`}
            onClick={!locked ? onClick : undefined}
            whileHover={!locked ? { y: -8 } : {}}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Image Area with Blobs */}
            <div className="w-image-area">
                <div
                    className="w-blob w-blob-1"
                    style={{ background: blobColor1 }}
                />
                <div
                    className="w-blob w-blob-2"
                    style={{ background: blobColor2 }}
                />
                <img src={image} alt={title} className="w-hero-img" />
            </div>

            {/* Content */}
            <div className="w-card-content">
                <div className="w-header">
                    <div className="w-icon-title">
                        <span className="w-icon">{icon}</span>
                        <div className="w-title">
                            <h3>{title}</h3>
                        </div>
                    </div>
                </div>

                {/* Pill */}
                {pillText && (
                    <div className={`w-stat-pill ${pillColor}`}>
                        {pillText}
                    </div>
                )}

                {/* Progress */}
                <div className="w-progress-container">
                    <div className="w-progress-bar">
                        <motion.div
                            className="w-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                        />
                    </div>
                    <div className="w-progress-text">
                        <span>{completed} / {total} Completed</span>
                        <span>{percent}%</span>
                    </div>
                </div>

                {/* CTA */}
                <button className={`w-cta-btn ${locked ? 'locked' : ''}`}>
                    {locked
                        ? '🔒 Locked'
                        : completed >= total
                            ? '✅ Completed'
                            : '🚀 Start Learning'}
                </button>
            </div>
        </motion.div>
    );
};

export default WordSectionCard;
