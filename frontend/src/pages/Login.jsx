import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/auth.css';

const Login = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!formData.displayName.trim()) {
          setError('Please tell us your name! 😊');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Oops! Passwords don\'t match 🔒');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('Password should be at least 6 characters long 🛡️');
          setLoading(false);
          return;
        }

        await authService.signUp(formData.email, formData.password, formData.displayName);
        navigate('/dashboard');
      } else {
        const result = await authService.login(formData.email, formData.password);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Something went wrong. Please try again! 🤔');
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again! 🤔');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await authService.signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again! 🤔');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Panel */}
      <div className="auth-left-panel">
        <div className="auth-welcome-content">
          <div className="mascot-welcome">
            <img src="/assets/avatar/mascot_glass.png" alt="EduSign Mascot" className="mascot-large" />
          </div>

          <h1 className="auth-title">Welcome to EduSign 👋</h1>
          <p className="auth-subtitle">
            A fun and interactive Indian Sign Language learning platform for kids
          </p>
          <p className="auth-description">
            Learn ISL through fun challenges, words, sentences, and friendly challenges. Designed for kids, trusted by parents.
          </p>

          <div className="auth-highlights">
            <div className="highlight-item">
              <span className="highlight-icon">🎈</span>
              <span>Have something fun</span>
            </div>
            <div className="highlight-item">
              <span className="highlight-icon">🖐️</span>
              <span>Practice signs live</span>
            </div>
            <div className="highlight-item">
              <span className="highlight-icon">🏅</span>
              <span>Earn badges & rewards</span>
            </div>
          </div>
        </div>

        <div className="auth-decorations">
          <div className="decoration-circle decoration-1"></div>
          <div className="decoration-circle decoration-2"></div>
          <div className="decoration-circle decoration-3"></div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">
              {isSignUp ? 'Create Your Account' : 'Sign In'}
            </h2>
            <p className="auth-card-subtitle">Let's continue learning together!</p>
          </div>

          {error && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in removed as requested */}

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="displayName" className="form-label">What should we call you? 😊</label>
                <input type="text" id="displayName" name="displayName" value={formData.displayName}
                  onChange={handleInputChange} className="form-input" placeholder="Your friendly name"
                  required disabled={loading} />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email address</label>
              <input type="email" id="email" name="email" value={formData.email}
                onChange={handleInputChange} className="form-input" placeholder="yourname@example.com"
                required disabled={loading} />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                {isSignUp ? 'Create a secret code 🔒' : 'Password'}
              </label>
              <input type="password" id="password" name="password" value={formData.password}
                onChange={handleInputChange} className="form-input" placeholder="••••••••"
                required disabled={loading} />
            </div>

            {isSignUp && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">Type it once more 👍</label>
                <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword}
                  onChange={handleInputChange} className="form-input" placeholder="••••••••"
                  required disabled={loading} />
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="loading-spinner">⏳</span> : isSignUp ? '🚀 Start Learning' : '✨ Let\'s Go'}
            </button>
          </form>

          <div className="auth-toggle">
            {isSignUp ? (
              <p>Already have an account? <button type="button" className="auth-toggle-btn"
                onClick={() => setIsSignUp(false)} disabled={loading}>Sign In</button></p>
            ) : (
              <p>New here? <button type="button" className="auth-toggle-btn"
                onClick={() => setIsSignUp(true)} disabled={loading}>Create account</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
