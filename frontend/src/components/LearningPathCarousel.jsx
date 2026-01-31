import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StageCard from './StageCard';

const LearningPathCarousel = ({ stages = [], onStageClick }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dragStart, setDragStart] = useState(0);
    const carouselRef = useRef(null);

    // Auto-scroll to unlocked/current stage
    useEffect(() => {
        const currentStageIndex = stages.findIndex(s => !s.completed && !s.locked);
        if (currentStageIndex !== -1) {
            setCurrentIndex(currentStageIndex);
        }
    }, [stages]);

    const handleDragEnd = (event, info) => {
        const threshold = 50;
        if (info.offset.x > threshold && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else if (info.offset.x < -threshold && currentIndex < stages.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goToSlide = (index) => {
        setCurrentIndex(Math.max(0, Math.min(index, stages.length - 1)));
    };

    const nextSlide = () => {
        if (currentIndex < stages.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const prevSlide = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    return (
        <div className="relative w-full overflow-hidden py-8">
            {/* Carousel Container */}
            <div className="relative h-96 md:h-[500px]" ref={carouselRef}>
                <motion.div
                    className="flex gap-6"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={handleDragEnd}
                    animate={{ x: `-${currentIndex * 100}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ width: `${stages.length * 100}%` }}
                >
                    {stages.map((stage, index) => (
                        <div
                            key={stage.id}
                            className="flex-shrink-0"
                            style={{ width: `${100 / stages.length}%` }}
                        >
                            <StageCard
                                {...stage}
                                isActive={index === currentIndex}
                                onClick={() => !stage.locked && onStageClick(stage)}
                            />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Navigation Arrows */}
            {stages.length > 1 && (
                <>
                    <motion.button
                        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg disabled:opacity-50"
                        onClick={prevSlide}
                        disabled={currentIndex === 0}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </motion.button>

                    <motion.button
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg disabled:opacity-50"
                        onClick={nextSlide}
                        disabled={currentIndex === stages.length - 1}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </motion.button>
                </>
            )}

            {/* Dot Indicators */}
            <div className="mt-6 flex justify-center gap-2">
                {stages.map((_, index) => (
                    <motion.button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`h-3 w-3 rounded-full transition-all ${index === currentIndex
                                ? 'w-8 bg-orange-500'
                                : 'bg-gray-300 hover:bg-gray-400'
                            }`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    />
                ))}
            </div>

            {/* Swipe Hint (Mobile) */}
            {stages.length > 1 && (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: 3, duration: 2 }}
                    className="mt-4 text-center text-sm text-gray-500 md:hidden"
                >
                    👆 Swipe to explore stages
                </motion.div>
            )}
        </div>
    );
};

export default LearningPathCarousel;
