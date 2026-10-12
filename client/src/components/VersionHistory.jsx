import { ChevronDown, GitCompare } from 'lucide-react';
import { useState } from 'react';
import { timeAgo } from '../lib/format.js';
import { DiffView } from './DiffView.jsx';
import { Markdown } from './Markdown.jsx';
import { Eyebrow, cx } from './ui.jsx';

const KIND = { research: 'Research', draft: 'Draft', final: 'Final' };

const DECISION = {
  pending: { label: 'Awaiting you', tone: 'text-accent font-medium' },
  approved: { label: 'Approved', tone: 'text-muted' },
  revised: { label: 'Sent back', tone: 'text-warn' },
  final: { label: 'Published', tone: 'text-muted' },
};

/** Timeline of every agent output, the human feedback that caused it, and what you decided. */
export function VersionHistory({ versions }) {
  const [openId, setOpenId] = useState(null);
  const [diffId, setDiffId] = useState(null);

  if (!versions.length) {
    return <p className="text-sm text-muted">Versions appear here as the agents work.</p>;
  }

  return (
    <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-line-strong">
      {versions.map((v) => {
        const decision = DECISION[v.decision] || DECISION.pending;
        const open = openId === v._id;
        // one class set per state (stacking two bg-*/border-* classes lets the stylesheet order decide)
        const dot = v.decision === 'pending' ? 'border-accent bg-accent' : v.kind === 'final' ? 'border-ink bg-ink' : 'border-line-strong bg-paper';
        const previous = versions.find((x) => x.kind === v.kind && x.number === v.number - 1);
        return (
          <li key={v._id} className="relative pl-6">
            <span className={cx('absolute left-0 top-[15px] size-[11px] rounded-full border-2', dot)} />
            <button
              onClick={() => setOpenId(open ? null : v._id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 rounded-md py-2 pr-1 text-left transition-colors hover:bg-sunken"
            >
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">
                    {KIND[v.kind]} v{v.number}
                  </span>
                  <span className={cx('text-xs', decision.tone)}>{decision.label}</span>
                </div>
                <span className="text-xs text-faint">{timeAgo(v.createdAt)}</span>
              </div>
              <ChevronDown className={cx('size-4 shrink-0 text-faint transition-transform', open && 'rotate-180')} strokeWidth={1.75} />
            </button>

            {v.feedback && (
              <p className="mb-1 border-l-2 border-line-strong pl-3 text-sm">
                <span className="text-xs font-medium text-muted">Your feedback: </span>
                <span className="font-serif italic text-ink">{v.feedback}</span>
              </p>
            )}

            {open && (
              <div className="rise my-2 rounded-md border border-line bg-surface p-4">
                {previous && (
                  <button onClick={() => setDiffId(diffId === v._id ? null : v._id)} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                    <GitCompare className="size-3.5" /> {diffId === v._id ? 'Show full text' : `Compare with v${previous.number}`}
                  </button>
                )}
                <div className="max-h-96 overflow-y-auto">
                  {diffId === v._id && previous ? <DiffView before={previous.content} after={v.content} /> : <Markdown className="prose-sm">{v.content}</Markdown>}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryCard({ versions }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
        <Eyebrow>Version history</Eyebrow>
        <span className="text-xs tabular-nums text-faint">{versions.length}</span>
      </div>
      <VersionHistory versions={versions} />
    </div>
  );
}
