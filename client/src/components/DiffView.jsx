import { useMemo } from 'react';
import { diffStats, wordDiff } from '../lib/diff.js';

/** Word-level comparison of two versions: additions highlighted, removals struck through. */
export function DiffView({ before, after }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after]);
  const { added, removed } = useMemo(() => diffStats(parts), [parts]);

  return (
    <div>
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="font-medium text-accent">+{added} words</span>
        <span className="font-medium text-danger">-{removed} words</span>
        <span>compared with the previous version</span>
      </p>
      <div className="whitespace-pre-wrap rounded-md bg-sunken p-4 font-mono text-[13px] leading-6 text-ink" data-testid="diff">
        {parts.map((p, i) =>
          p.added ? (
            <ins key={i} className="rounded-sm bg-accent-soft text-accent no-underline">
              {p.value}
            </ins>
          ) : p.removed ? (
            <del key={i} className="rounded-sm bg-danger-soft text-danger">
              {p.value}
            </del>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </div>
    </div>
  );
}
