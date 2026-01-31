import React from 'react';
import { motion } from 'framer-motion';

const ALL_BADGES = [
  { 
    id: 'first_steps', 
    name: 'First Steps', 
    icon: '👣', 
    requirement: 'Complete 5 letters',
    color: '#FFD166',
    threshold: 5
  },
  { 
    id: 'halfway_hero', 
    name: 'Halfway Hero', 
    icon: '🦸', 
    requirement: 'Complete 13 letters',
    color: '#06FFA5',
    threshold: 13
  },
  { 
    id: 'alphabet_master', 
    name: 'Alphabet Master', 
    icon: '🏆', 
    requirement: 'Complete all 26 letters',
    color: '#FF8C42',
    threshold: 26
  },
  { 
    id: 'speed_demon', 
    name: 'Speed Demon', 
    icon: '⚡', 
    requirement: 'Complete 10 letters in one session',
    color: '#F77F00',
    threshold: 10
  },
  { 
    id: 'perfect_week', 
    name: 'Perfect Week', 
    icon: '🔥', 
    requirement: 'Practice 7 days in a row',
    color: '#FF006E',
    threshold: 7
  },
  { 
    id: 'early_bird', 
    name: 'Early Bird', 
    icon: '🌅', 
    requirement: 'Practice before 9 AM',
    color: '#8338EC',
    threshold: 1
  }
];

const BadgePanel = ({ badges }) => {
  return (
    <div className="badge-panel">
      <h3 className="badge-title">🏅 Your Achievements</h3>
      
      <div className="badges-grid">
        {ALL_BADGES.map((badge, index) => {
          const earned = badges.includes(badge.name);
          
          return (
            <motion.div
              key={badge.id}
              className={`badge-card ${earned ? 'earned' : 'locked'}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: earned ? 1.1 : 1 }}
            >
              <div 
                className="badge-icon"
                style={{ 
                  filter: earned ? 'none' : 'grayscale(100%)',
                  opacity: earned ? 1 : 0.3
                }}
              >
                {badge.icon}
              </div>
              
              <h4 style={{ color: earned ? badge.color : '#999' }}>
                {badge.name}
              </h4>
              
              <p className="badge-requirement">{badge.requirement}</p>
              
              {earned && (
                <motion.div
                  className="earned-stamp"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                >
                  ✓ EARNED
                </motion.div>
              )}
              
              {!earned && (
                <div className="badge-lock">🔒</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgePanel;