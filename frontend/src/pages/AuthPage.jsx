import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/authpage.css';

const AuthPage = () => {
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
        setError(''); // Clear error on input
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                // Validate Sign Up
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
                // Sign In
                await authService.signIn(formData.email, formData.password);
                navigate('/dashboard');
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
            {/* Left Panel - Welcome Section */}
            <div className="auth-left-panel">
                <div className="auth-welcome-content">
                    <div className="mascot-welcome">
                        <img src="/assets/avatar/mascot.png" alt="EduSign Mascot" className="mascot-large" />
                    </div>

                    <h1 className="auth-title">Welcome to EduSign 👋</h1>

                    <p className="auth-subtitle">
                        A fun and interactive Indian Sign Language learning platform for kids
                    </p>

                    <p className="auth-description">
                        Learn ISL through games, words, sentences, and friendly challenges. Designed for kids, trusted by parents.
                    </p>

                    <div className="auth-highlights">
                        <div className="highlight-item">
                            <span className="highlight-icon">🎮</span>
                            <span>Learn with games</span>
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

            {/* Right Panel - Auth Form */}
            <div className="auth-right-panel">
                <div className="auth-card">
                    {/* Header */}
                    <div className="auth-card-header">
                        <h2 className="auth-card-title">
                            {isSignUp ? 'Create Your Account' : 'Sign In'}
                        </h2>
                        <p className="auth-card-subtitle">
                            Let's continue learning together!
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="auth-error">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google Sign In */}
                    <button
                        type="button"
                        className="auth-google-btn"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Continue with Google</span>
                        <span className="google-recommended">(recommended for parents)</span>
                    </button>

                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        {isSignUp && (
                            <div className="form-group">
                                <label htmlFor="displayName" className="form-label">
                                    What should we call you? 😊
                                </label>
                                <input
                                    type="text"
                                    id="displayName"
                                    name="displayName"
                                    value={formData.displayName}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    placeholder="Your friendly name"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                Email address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="form-input"
                                placeholder="yourname@example.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                {isSignUp ? 'Create a secret code 🔒' : 'Password'}
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className="form-input"
                                placeholder="••••••••"
                                required
                                disabled={loading}
                            />
                        </div>

                        {isSignUp && (
                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">
                                    Type it once more 👍
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="loading-spinner">⏳</span>
                            ) : isSignUp ? (
                                '🚀 Start Learning'
                            ) : (
                                '✨ Let\'s Go'
                            )}
                        </button>
                    </form>

                    {/* Toggle Sign In / Sign Up */}
                    <div className="auth-toggle">
                        {isSignUp ? (
                            <p>
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    className="auth-toggle-btn"
                                    onClick={() => setIsSignUp(false)}
                                    disabled={loading}
                                >
                                    Sign In
                                </button>
                            </p>
                        ) : (
                            <p>
                                New here?{' '}
                                <button
                                    type="button"
                                    className="auth-toggle-btn"
                                    onClick={() => setIsSignUp(true)}
                                    disabled={loading}
                                >
                                    Create account
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
