import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { WorkspaceHomePage } from './pages/WorkspaceHomePage.js';
import { ProtectedRoute, OnboardingRoute, PublicOnlyRoute } from './components/AuthGuard.js';

// Google Client ID from environment or standard placeholder for developer testing
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1084251952345-demo-adavya-client-id.apps.googleusercontent.com';

export const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />

            {/* Onboarding Route for authenticated users who haven't linked a team yet */}
            <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <OnboardingPage />
                </OnboardingRoute>
              }
            />

            {/* Protected Workspace Routes for onboarded users */}
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <WorkspaceHomePage />
                </ProtectedRoute>
              }
            />

            {/* Default root path redirects into protected workspace or login via guard */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <WorkspaceHomePage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
