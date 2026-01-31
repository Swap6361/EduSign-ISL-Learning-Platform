import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LessonPage from './pages/LessonPage';
import BeginnerStagePage from './pages/BeginnerStagePage';
import NumberLessonPage from './pages/NumberLessonPage';
import IntermediateStagePage from './pages/IntermediateStagePage';
import WordLessonPage from './pages/WordLessonPage';
import DaysLessonPage from './pages/DaysLessonPage';
import ColorsLessonPage from './pages/ColorsLessonPage';
import GeneralWordsLessonPage from './pages/GeneralWordsLessonPage';
import GeneralWordsStagePage from './pages/GeneralWordsStagePage';
import LessonPageGen1 from './pages/LessonPageGen1';
import LessonPageGen2 from './pages/LessonPageGen2';
import AZWordsLessonPage from './pages/AZWordsLessonPage';
import SentenceStagePage from './pages/SentenceStagePage';
import SentenceLessonPage from './pages/SentenceLessonPage';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import './styles/theme.css';
import './styles/main.css';

function App() {
    return (
        <Router>
            <Routes>
                {/* Public Routes (Redirect to Dashboard if logged in) */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/signup"
                    element={
                        <PublicRoute>
                            <Signup />
                        </PublicRoute>
                    }
                />

                {/* Protected routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/lesson"
                    element={
                        <ProtectedRoute>
                            <LessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/beginner-stage"
                    element={
                        <ProtectedRoute>
                            <BeginnerStagePage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/number-lesson"
                    element={
                        <ProtectedRoute>
                            <NumberLessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/intermediate-stage"
                    element={
                        <ProtectedRoute>
                            <IntermediateStagePage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/word-lesson"
                    element={
                        <ProtectedRoute>
                            <WordLessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/days-lesson"
                    element={
                        <ProtectedRoute>
                            <DaysLessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/colors-lesson"
                    element={
                        <ProtectedRoute>
                            <ColorsLessonPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/general-words-lesson"
                    element={
                        <ProtectedRoute>
                            <GeneralWordsLessonPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/general-words"
                    element={
                        <ProtectedRoute>
                            <GeneralWordsStagePage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/general-words-stage1"
                    element={
                        <ProtectedRoute>
                            <LessonPageGen1 />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/general-words-stage2"
                    element={
                        <ProtectedRoute>
                            <LessonPageGen2 />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/a-z-words-lesson"
                    element={
                        <ProtectedRoute>
                            <AZWordsLessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/sentence-stage"
                    element={
                        <ProtectedRoute>
                            <SentenceStagePage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/sentence-lesson"
                    element={
                        <ProtectedRoute>
                            <SentenceLessonPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                {/* Redirect root to login (which will redirect to dashboard if auth) */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Catch all - redirect to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;

