import { Moon, Sun } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useSocketStatus } from '../lib/socket.jsx';
import { useTheme } from '../lib/theme.jsx';
import { Logo } from './Logo.jsx';
import { Button, cx } from './ui.jsx';

export function ThemeToggle({ className }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cx('rounded-md p-2 text-muted transition-colors hover:bg-sunken hover:text-ink', className)}
    >
      {theme === 'dark' ? <Sun className="size-[18px]" strokeWidth={1.75} /> : <Moon className="size-[18px]" strokeWidth={1.75} />}
    </button>
  );
}

function LiveIndicator() {
  const { connected } = useSocketStatus();
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex" title={connected ? 'Receiving live updates' : 'Reconnecting…'}>
      <span className={cx('size-1.5 rounded-full', connected ? 'bg-accent' : 'bg-faint')} />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/projects" aria-label="BlogFlow home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <LiveIndicator />
            <ThemeToggle />
            <span className="hidden max-w-44 truncate text-sm text-muted sm:block">{user?.name || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
