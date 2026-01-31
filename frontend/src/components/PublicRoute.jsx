import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/loading.css';

const PublicRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const unsubscribe = authService.onAuthStateChange((user) => {
            setAuthenticated(!!user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <img src="/mascot.png" alt="Loading" className="loading-mascot" />
                    <div className="spinner"></div>
                    <p>Checking session...</p>
                </div>
            </div>
        );
    }

    // If authenticated, redirect to dashboard. Otherwise, show login/signup.
    return authenticated ? <Navigate to="/dashboard" replace /> : children;
};

export default PublicRoute;
