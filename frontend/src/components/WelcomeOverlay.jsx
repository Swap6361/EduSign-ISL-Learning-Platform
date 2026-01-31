import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/welcome-overlay.css';

const WelcomeOverlay = ({ userName, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const walkthroughSteps = [
    {
      emoji: '🎉',
      title: `Welcome to EduSign, ${userName}!`,
      description: 'Your journey to mastering Indian Sign Language starts here!',
      quote: '"Every sign you learn is a bridge to better communication."'
    },
    {
      emoji: '🏝️',
      title: 'Alphabet Island',
      description: 'Start with mastering all 26 letters. Complete this stage to unlock your first reward - a Hat!',
      quote: '"Master the basics, unlock the world."'
    },
    {
      emoji: '🌴',
      title: 'Word Jungle',
      description: 'Collect 5-word bundles to earn stars. Complete this stage to unlock Glasses!',
      quote: '"Words are the building blocks of communication."'
    },
    {
      emoji: '🦁',
      title: 'Sentence Safari',
      description: 'Say full ideas with your hands. Express yourself completely!',
      quote: '"Complete thoughts, complete understanding."'
    },
    {
      emoji: '🎯',
      title: 'Ready to Start?',
      description: 'Show your hands, earn stars, and let the mascot cheer for you!',
      quote: '"Your learning adventure begins now!"'
    }
  ];

  const handleNext = () => {
    if (currentStep < walkthroughSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  const currentStepData = walkthroughSteps[currentStep];
  const isLastStep = currentStep === walkthroughSteps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        className="welcome-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="welcome-overlay-content"
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isLastStep && (
            <button className="welcome-close-btn" onClick={handleClose}>×</button>
          )}

          <motion.div
            className="welcome-mascot"
            key={currentStep}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="celebration-emoji">{currentStepData.emoji}</div>
            <img src="/assets/avatar/mascot.png" alt="Mascot" className="mascot-image" />
          </motion.div>

          <motion.div
            key={`title-${currentStep}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="welcome-title">{currentStepData.title}</h1>
          </motion.div>

          <motion.div
            key={`content-${currentStep}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.3 }}
            className="welcome-content-section"
          >
            <p className="welcome-description">{currentStepData.description}</p>
            <div className="welcome-quote-box">
              <span className="quote-mark">"</span>
              <p className="welcome-quote">{currentStepData.quote}</p>
            </div>
          </motion.div>

          <div className="welcome-progress-dots">
            {walkthroughSteps.map((_, index) => (
              <div
                key={index}
                className={`progress-dot ${index === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>

          <div className="welcome-actions">
            {currentStep > 0 && (
              <button className="welcome-prev-btn" onClick={() => setCurrentStep(currentStep - 1)}>
                ← Previous
              </button>
            )}
            <button className="welcome-next-btn" onClick={handleNext}>
              {isLastStep ? "Let's Start Learning! 🎓" : 'Next →'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeOverlay;




