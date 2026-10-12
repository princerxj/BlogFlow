import { cx } from './ui.jsx';

/** Plain typographic wordmark: a small square (three lines of text) and the name. */
export function Logo({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-6 shrink-0 text-accent" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="currentColor" />
        <rect x="9" y="9" width="14" height="3" fill="var(--paper)" />
        <rect x="9" y="15" width="14" height="3" fill="var(--paper)" />
        <rect x="9" y="21" width="8" height="3" fill="var(--paper)" />
      </svg>
      <span className="font-serif text-xl font-semibold tracking-tight">BlogFlow</span>
    </span>
  );
}
