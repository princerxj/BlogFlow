import { diffWords } from 'diff';

/** Word-level diff: returns parts [{ value, added?, removed? }]. */
export const wordDiff = (before, after) => diffWords(before ?? '', after ?? '');

export function diffStats(parts) {
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    const n = p.value.trim() ? p.value.trim().split(/\s+/).length : 0;
    if (p.added) added += n;
    else if (p.removed) removed += n;
  }
  return { added, removed };
}
