import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { HomePage } from './pages/HomePage.js';
import { AdminPage } from './admin/AdminPage.js';
import { FullScreenMessage } from './components/ui.js';

const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenMessage title="Checking session…" spinner />;
  return session ? <Navigate to="/" replace /> : <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
