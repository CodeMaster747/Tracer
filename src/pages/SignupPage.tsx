import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconGoogle } from '@/components/ui/Icon';
import { AuthLayout } from '@/components/layout/AuthLayout';
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
    <AuthLayout
      title="Create your account"
      subtitle="Start solving engineering drawings step by step"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}
        <Button type="submit" loading={loading} fullWidth size="lg">
          Create account
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="u-label">or</span>
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
    </AuthLayout>
  );
}
