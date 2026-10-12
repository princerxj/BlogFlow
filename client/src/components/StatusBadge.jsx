import { STATUS } from '../lib/format.js';
import { deriveSteps } from '../lib/steps.js';
import { cx } from './ui.jsx';

const TEXT = { warn: 'text-warn', accent: 'text-accent', done: 'text-ink', danger: 'text-danger' };
const DOT = { warn: 'bg-warn', accent: 'bg-accent', done: 'bg-ink', danger: 'bg-danger' };

/** Status as a coloured dot plus a plain-language label (colour is never the only signal). */
export function StatusBadge({ status }) {
  const meta = STATUS[status] || { label: status, tone: 'done' };
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', TEXT[meta.tone])}>
      <span className={cx('size-1.5 rounded-full', DOT[meta.tone], meta.pulse && 'animate-pulse')} />
      {meta.label}
    </span>
  );
}

const SEGMENT = {
  done: 'bg-ink',
  active: 'bg-warn animate-pulse',
  waiting: 'bg-accent',
  error: 'bg-danger',
  pending: 'bg-line-strong/60',
};

/** Five thin segments: a glanceable version of the workflow stepper for list rows. */
export function MiniProgress({ project }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label="Workflow progress">
      {deriveSteps(project).map((s) => (
        <span key={s.key} className={cx('h-1 flex-1 rounded-full', SEGMENT[s.state])} />
      ))}
    </div>
  );
}
