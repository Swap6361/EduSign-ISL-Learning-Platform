import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/auth.css';

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Please tell us your name! 😊');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords don\'t match! Try again 🔐');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters 🔒');
      return;
    }

    setLoading(true);

    // Sign up user
    const result = await authService.signUp(email, password, name);

    if (result.success) {
      // Mark as new user for welcome overlay
      localStorage.setItem('showWelcomeOverlay', 'true');

      // Navigate to dashboard immediately
      navigate('/dashboard');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  if (showCelebration) {
    return (
      <div className="celebration-screen">
        <div className="celebration-content">
          <img src="/mascot.png" alt="Welcome" className="celebration-mascot" />
          <h1 className="celebration-title">🎉 Welcome to EduSign !</h1>
          <p className="celebration-message">Hi {name}! Let's start your sign language journey!</p>
          <div className="confetti"></div>
          <div className="confetti"></div>
          <div className="confetti"></div>
          <div className="confetti"></div>
          <div className="confetti"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-mascot">
        <img src="/mascot.png" alt="EduSign Mascot" className="mascot-wave" />
        <div className="speech-bubble">
          Hi there! Let's start learning! 🌟
        </div>
      </div>

      <div className="auth-card">
        <h1>🎉 Join EduSign</h1>
        <p className="auth-subtitle">Start your sign language adventure today!</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>👤 Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>📧 Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>🔒 Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>🔒 Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type password again"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '🔄 Creating account...' : '🚀 Start Learning!'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Login here!</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;