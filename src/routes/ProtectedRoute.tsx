import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export default function ProtectedRoute() {
  const { user, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center grid-bg">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
