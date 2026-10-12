import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../components/Layout.jsx';
import { Logo } from '../components/Logo.jsx';
import { Button, Input, Spinner, cx } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const PIPELINE = [
  { who: 'Researcher', what: 'outlines the post', you: false },
  { who: 'You', what: 'approve it, or send it back with notes', you: true },
  { who: 'Writer', what: 'drafts the full post', you: false },
  { who: 'You', what: 'approve it, or send it back again', you: true },
  { who: 'Editor', what: 'polishes the final version', you: false },
];

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between border-r border-line bg-sunken p-12 lg:flex xl:p-16">
        <Logo />
        <div className="max-w-md">
          <h1 className="font-serif text-5xl font-semibold leading-[1.08] tracking-tight">
            Write with agents.
            <br />
            Keep the final say.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">Three agents draft your blog post. Nothing moves forward until you approve it.</p>
          <ol className="mt-10 divide-y divide-line-strong/70 border-y border-line-strong/70">
            {PIPELINE.map((s, i) => (
              <li key={i} className="flex items-baseline gap-4 py-3">
                <span className="w-4 text-sm tabular-nums text-faint">{i + 1}</span>
                <span className={cx('w-24 shrink-0 font-medium', s.you && 'text-accent')}>{s.who}</span>
                <span className="text-muted">{s.what}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-muted">Every version, and every piece of feedback, is saved.</p>
      </aside>

      <section className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="rise mx-auto w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="font-serif text-4xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-muted">{footer}</p>
        </div>
      </section>
    </div>
  );
}

function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      right={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="rounded-md p-1.5 text-faint hover:text-ink">
          {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
        </button>
      }
    />
  );
}

function useAuthForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (e, fn) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

function Redirector() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (status === 'authed') return <Navigate to={location.state?.from || '/projects'} replace />;
  return null;
}

const FormError = ({ children }) => (
  <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
    {children}
  </p>
);
const textLink = 'font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink';

export function LoginPage() {
  const { login, status } = useAuth();
  const { error, busy, run } = useAuthForm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (status !== 'guest') return <Redirector />;

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue your blogs." footer={<>New here? <Link to="/register" className={textLink}>Create an account</Link></>}>
      <form onSubmit={(e) => run(e, () => login(email, password))} className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register, status } = useAuth();
  const { error, busy, run } = useAuthForm();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (status !== 'guest') return <Redirector />;

  return (
    <AuthLayout title="Create your account" subtitle="Start writing with agents you control." footer={<>Already have an account? <Link to="/login" className={textLink}>Log in</Link></>}>
      <form onSubmit={(e) => run(e, () => register(email, password, name.trim()))} className="space-y-5">
        <Input label="Name (optional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} />
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <PasswordInput label="Password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
