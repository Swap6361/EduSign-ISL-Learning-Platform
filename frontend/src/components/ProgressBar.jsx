import React from 'react';

const ProgressBar = ({ completed, total, label = "Your Progress" }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-header">
        <span className="progress-title">{label}</span>
        <span className="progress-fraction">{completed} / {total} completed</span>
      </div>
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ 
            width: `${percentage}%`
          }}
        >
          {percentage > 0 && (
            <span className="progress-text">{percentage}%</span>
          )}
        </div>
        {percentage === 0 && (
          <span className="progress-text-overlay">0%</span>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;