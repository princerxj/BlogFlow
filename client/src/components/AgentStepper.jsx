import { Check, UserRound, X } from 'lucide-react';
import { deriveSteps } from '../lib/steps.js';
import { cx } from './ui.jsx';

// Agents are circles, your review gates are squares: the shape tells you who acts.
const NODES = {
  researcher: { label: 'Researcher', sub: 'Outline' },
  review_research: { label: 'Your review', sub: 'Your call', human: true },
  writer: { label: 'Writer', sub: 'Draft' },
  review_draft: { label: 'Your review', sub: 'Your call', human: true },
  editor: { label: 'Editor', sub: 'Polish' },
};

const CAPTION = { done: 'Done', active: 'Working…', waiting: 'Your turn', error: 'Failed', pending: '' };
const CAPTION_TONE = { done: 'text-muted', active: 'text-warn', waiting: 'text-accent', error: 'text-danger', pending: 'text-faint' };

function Node({ step, human }) {
  const shape = human ? 'rounded-md' : 'rounded-full';
  // no background on the base: each state sets its own (two bg-* classes on one element fight in the cascade)
  const base = cx('relative mx-auto grid size-7 place-items-center', shape);
  switch (step.state) {
    case 'done':
      return <span className={cx(base, 'bg-ink text-paper')}><Check className="size-3.5" strokeWidth={2.5} /></span>;
    case 'active':
      return (
        <span className={cx(base, 'border-2 border-warn bg-surface')}>
          <span className="size-3 animate-spin rounded-full border-2 border-warn border-t-transparent" />
        </span>
      );
    case 'waiting':
      return <span className={cx(base, 'bg-accent text-on-accent ring-4 ring-accent-soft')}><UserRound className="size-3.5" strokeWidth={2} /></span>;
    case 'error':
      return <span className={cx(base, 'bg-danger text-paper')}><X className="size-3.5" strokeWidth={2.5} /></span>;
    default:
      return <span className={cx(base, 'border border-line-strong bg-surface text-[11px] text-faint')}>{step.index + 1}</span>;
  }
}

export function AgentStepper({ project }) {
  const steps = deriveSteps(project);
  return (
    <ol className="flex" aria-label="Workflow progress">
      {steps.map((step, i) => {
        const node = NODES[step.key];
        return (
          <li key={step.key} className="relative min-w-0 flex-1 text-center" aria-current={step.state === 'active' || step.state === 'waiting' ? 'step' : undefined}>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={cx('absolute left-1/2 top-[13px] h-px w-full', step.state === 'done' ? 'bg-ink' : 'bg-line-strong')} />
            )}
            <Node step={step} human={node.human} />
            <span className="mt-2 block text-xs font-medium sm:text-sm">{node.label}</span>
            <span className={cx('block text-[11px] sm:text-xs', CAPTION_TONE[step.state])}>
              {CAPTION[step.state] || <span className="hidden sm:inline">{node.sub}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
