import { Loader2, X } from 'lucide-react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Button
// Ink is the default; the accent colour is reserved for the action the user is here to take.
const BUTTON_VARIANTS = {
  primary: 'bg-ink text-paper hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
};
const BUTTON_SIZES = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-11 px-5 text-[15px] gap-2' };

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, children, className, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}

// -------------------------------------------------------------------- Surfaces
export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface', className)} {...props}>
      {children}
    </div>
  );
}

/** Small uppercase label used for section headings. */
export function Eyebrow({ children, className }) {
  return <p className={cx('text-xs font-medium uppercase tracking-[0.08em] text-muted', className)}>{children}</p>;
}

export function Tag({ children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded border border-line bg-sunken px-1.5 py-0.5 text-xs text-muted', className)}>{children}</span>;
}

// ------------------------------------------------------------------- Fields
const fieldBase =
  'block w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint ' +
  'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-55';

function Field({ label, error, hint, id, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, className, right, ...props }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <div className="relative">
        <input ref={ref} id={id} aria-invalid={!!error} className={cx(fieldBase, 'h-10', right && 'pr-11', error && 'border-danger', className)} {...props} />
        {right && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{right}</div>}
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, ...props }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <textarea ref={ref} id={id} aria-invalid={!!error} className={cx(fieldBase, 'resize-y py-2.5 leading-relaxed', error && 'border-danger', className)} {...props} />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, className, children, ...props }, ref) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <select ref={ref} id={id} className={cx(fieldBase, 'h-10', className)} {...props}>
        {children}
      </select>
    </Field>
  );
});

// -------------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, subtitle, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal to <body>: a `position: fixed` overlay inside a transformed ancestor would be positioned
  // relative to that ancestor instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className={cx(
          'rise relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface p-6 shadow-2xl shadow-black/20 sm:rounded-xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1 rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// -------------------------------------------------------------------- Toasts
const ToastContext = createContext({ success: () => {}, error: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), 5500);
    },
    [dismiss],
  );
  // Stable identity: pages put `toast` in effect dependencies, so it must not change on every render.
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md px-4 py-3 text-sm shadow-lg shadow-black/15',
              t.kind === 'error' ? 'bg-danger text-paper' : 'bg-ink text-paper',
            )}
          >
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --------------------------------------------------------------- Misc pieces
export function Spinner({ className }) {
  return <Loader2 className={cx('size-5 animate-spin text-muted', className)} />;
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded bg-sunken', className)} />;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
      <h3 className="font-serif text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
