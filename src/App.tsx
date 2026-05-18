import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import ProtectedRoute from '@/routes/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ProfilePage from '@/pages/ProfilePage';
import HistoryPage from '@/pages/HistoryPage';
import SavedPage from '@/pages/SavedPage';
import SettingsPage from '@/pages/SettingsPage';
import GraphicsPage from '@/pages/GraphicsPage';
import AutomataPage from '@/pages/AutomataPage';
import ControlPage from '@/pages/ControlPage';
import CanvasPage from '@/pages/CanvasPage';

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="history" replace />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="graphics" element={<GraphicsPage />} />
          <Route path="automata" element={<AutomataPage />} />
          <Route path="control" element={<ControlPage />} />
        </Route>
        <Route path="/app/canvas/:id" element={<CanvasPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRoute() {
  const { user, initialized } = useAuthStore();
  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-primary">
        <div className="text-text-muted text-xs">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/app/history" replace />;
  return <HomePage />;
}
