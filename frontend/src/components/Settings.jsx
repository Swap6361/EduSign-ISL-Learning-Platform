import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Settings = ({ onClose }) => {
  const [settings, setSettings] = useState({
    useWebSocket: true,
    frameInterval: 500,
    confidenceThreshold: 0.85,
    soundEnabled: true,
    useFirebase: false
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('eduSignSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('eduSignSettings', JSON.stringify(newSettings));
  };

  return (
    <motion.div
      className="settings-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="settings-modal"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* WebSocket Toggle */}
          <div className="setting-item">
            <div className="setting-info">
              <h4>Use WebSocket</h4>
              <p>Faster real-time predictions (recommended)</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.useWebSocket}
                onChange={(e) => handleChange('useWebSocket', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Frame Interval */}
          <div className="setting-item">
            <div className="setting-info">
              <h4>Frame Interval</h4>
              <p>Time between predictions: {settings.frameInterval}ms</p>
            </div>
            <input
              type="range"
              min="200"
              max="1000"
              step="100"
              value={settings.frameInterval}
              onChange={(e) => handleChange('frameInterval', Number(e.target.value))}
              className="slider"
            />
          </div>

          {/* Confidence Threshold */}
          <div className="setting-item">
            <div className="setting-info">
              <h4>Confidence Threshold</h4>
              <p>Minimum accuracy required: {Math.round(settings.confidenceThreshold * 100)}%</p>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.confidenceThreshold}
              onChange={(e) => handleChange('confidenceThreshold', Number(e.target.value))}
              className="slider"
            />
          </div>

          {/* Sound Toggle */}
          <div className="setting-item">
            <div className="setting-info">
              <h4>Sound Effects</h4>
              <p>Play sounds for feedback</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => handleChange('soundEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Firebase Toggle */}
          <div className="setting-item">
            <div className="setting-info">
              <h4>Cloud Sync (Firebase)</h4>
              <p>Save progress to cloud (requires setup)</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.useFirebase}
                onChange={(e) => handleChange('useFirebase', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-primary" onClick={onClose}>
            Save & Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Settings;