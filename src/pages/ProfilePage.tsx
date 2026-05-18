import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { IconLogout } from '@/components/ui/Icon';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-3xl px-8 py-12"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Your account information
          </p>
        </header>

        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-8">
          <div className="flex items-center gap-5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full border border-border-subtle"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle bg-white/[0.04] text-lg font-semibold text-text-primary">
                {(user?.displayName ?? user?.email ?? '?')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-text-primary">
                {user?.displayName ?? user?.email ?? 'Account'}
              </div>
              <div className="mt-0.5 truncate text-sm text-text-secondary">
                {user?.email ?? '—'}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Field label="User ID" value={user?.uid ?? '—'} mono />
            <Field
              label="Display name"
              value={user?.displayName ?? 'Not set'}
            />
            <Field label="Email" value={user?.email ?? 'Not set'} />
            <Field
              label="Sign-in provider"
              value={user?.photoURL ? 'Google' : 'Email & Password'}
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-2 border-t border-border-subtle pt-6">
            <Button
              variant="secondary"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              Switch account
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={loggingOut}
              loading={loggingOut}
              leftIcon={<IconLogout className="h-3.5 w-3.5" />}
            >
              Sign out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-white/[0.02] px-4 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm text-text-primary ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
