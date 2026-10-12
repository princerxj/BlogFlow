import { GitCompare } from 'lucide-react';
import { useState } from 'react';
import { DiffView } from './DiffView.jsx';
import { Markdown } from './Markdown.jsx';
import { Button, Tag, Textarea, cx } from './ui.jsx';

const QUICK_FEEDBACK = ['Make it shorter', 'Add concrete examples', 'Use simpler language', 'Stronger hook', 'More actionable'];

const COPY = {
  research: { title: 'Review the research outline', hint: 'Approve to hand it to the Writer, or tell the Researcher what to change.', noun: 'Research' },
  draft: { title: 'Review the draft', hint: 'Approve to send it to the Editor, or tell the Writer what to change.', noun: 'Draft' },
};

function RevisionMeter({ used, max }) {
  if (max == null) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted" title={`${used} of ${max} revisions used`}>
      <span>Revisions</span>
      <span className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cx('size-2 rounded-[2px]', i < used ? 'bg-ink' : 'border border-line-strong')} />
        ))}
      </span>
      <span className="tabular-nums">
        {used}/{max}
      </span>
    </div>
  );
}

export function ReviewPanel({ project, version, previous, busy, onApprove, onRevise }) {
  const [feedback, setFeedback] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  const copy = COPY[version.kind] || COPY.draft;
  const used = version.kind === 'research' ? project.researchRevisions : project.draftRevisions;
  const max = project.maxRevisions;
  const canRevise = max == null || used < max;
  const trimmed = feedback.trim();

  const revise = async () => {
    if (!trimmed || !canRevise || busy) return;
    if (await onRevise(trimmed)) setFeedback('');
  };

  return (
    <section className="rise">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">{copy.hint}</p>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <Tag>
            {copy.noun} v{version.number}
          </Tag>
          <RevisionMeter used={used} max={max} />
        </div>
      </div>

      {(version.feedback || previous) && (
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          {version.feedback ? (
            <p className="max-w-xl border-l-2 border-accent pl-3 text-sm text-ink">
              <span className="font-medium">Applied your feedback: </span>
              <span className="font-serif text-[15px] italic text-muted">{version.feedback}</span>
            </p>
          ) : (
            <span />
          )}
          {previous && (
            <Button variant="outline" size="sm" icon={GitCompare} onClick={() => setShowDiff((v) => !v)} aria-pressed={showDiff}>
              {showDiff ? 'Hide changes' : `Show changes since v${previous.number}`}
            </Button>
          )}
        </div>
      )}

      <div className="relative mt-5">
        <div
          className="max-h-[32rem] overflow-y-auto rounded-lg border border-line bg-surface p-6 pb-12 sm:p-8 sm:pb-12"
          tabIndex={0}
          aria-label="Content to review"
        >
          {showDiff && previous ? <DiffView before={previous.content} after={version.content} /> : <Markdown>{version.content}</Markdown>}
        </div>
        {/* paper-coloured fade at the bottom: hints that there is more to scroll */}
        <div className="pointer-events-none absolute inset-x-px bottom-px h-12 rounded-b-lg bg-gradient-to-t from-surface to-transparent" />
      </div>

      <div className="mt-7 space-y-3">
        <Textarea
          label="Request changes"
          rows={3}
          value={feedback}
          disabled={busy || !canRevise}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && revise()}
          placeholder={canRevise ? 'What should change? Be specific: the agent revises based on this.' : 'Revision limit reached for this stage.'}
          hint={!canRevise ? `You've used all ${max} revisions for this stage. Approve to continue.` : 'Ctrl/Cmd + Enter to send'}
        />
        {canRevise && (
          <div className="flex flex-wrap gap-2">
            {QUICK_FEEDBACK.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()}. ${q}` : q))}
                className="rounded border border-line-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50"
              >
                + {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={!trimmed || !canRevise || busy} onClick={revise}>
            Send back with feedback
          </Button>
          <Button variant="accent" loading={busy} onClick={onApprove}>
            Approve and continue
          </Button>
        </div>
      </div>
    </section>
  );
}
