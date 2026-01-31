import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/loading.css';

const ProtectedRoute = ({ children }) => {
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
          <p>Loading your adventure...</p>
        </div>
      </div>
    );
  }

  return authenticated ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;