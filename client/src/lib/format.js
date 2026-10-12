export function timeAgo(date) {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export const wordCount = (text = '') => (text.trim() ? text.trim().split(/\s+/).length : 0);
export const readMinutes = (text) => Math.max(1, Math.round(wordCount(text) / 220));

/** First markdown heading, used as the blog title. */
export function titleOf(markdown = '', fallback = 'Untitled') {
  const m = markdown.match(/^\s*#{1,2}\s+(.+)$/m);
  return (m ? m[1] : fallback).replace(/[*_`]/g, '').trim();
}

// tone: warn (working), accent (your turn), done (finished), danger (failed)
export const STATUS = {
  running: { label: 'Working', tone: 'warn', pulse: true },
  awaiting_review: { label: 'Needs your review', tone: 'accent' },
  completed: { label: 'Completed', tone: 'done' },
  stalled: { label: 'Step failed', tone: 'danger' },
  failed_to_start: { label: "Couldn't start", tone: 'danger' },
  starting: { label: 'Starting', tone: 'warn', pulse: true },
};

export const AGENT = {
  researcher: { label: 'Researcher', doing: 'is researching your topic' },
  writer: { label: 'Writer', doing: 'is drafting the blog post' },
  editor: { label: 'Editor', doing: 'is polishing the final version' },
};
