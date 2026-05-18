import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { IconGoogle } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUpEmail, signInGoogle, loading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await signUpEmail(email, password, name);
      navigate('/app/history');
    } catch {
      /* error surfaced via store */
    }
  };

  const handleGoogle = async () => {
    clearError();
    try {
      await signInGoogle();
      navigate('/app/history');
    } catch {
      /* error surfaced via store */
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[400px] px-6"
      >
        <div className="mb-8 flex items-center gap-3">
          <Logo size={28} />
          <span className="text-[15px] font-semibold tracking-tight">Tracer</span>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Start solving engineering drawings step-by-step
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              minLength={6}
            />
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} fullWidth size="lg">
              Create account
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-[11px] uppercase tracking-wider text-text-muted">
              or
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <Button
            variant="secondary"
            fullWidth
            size="lg"
            onClick={handleGoogle}
            leftIcon={<IconGoogle className="h-4 w-4" />}
            disabled={loading}
          >
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-text-primary transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
