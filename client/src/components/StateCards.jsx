import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AGENT, readMinutes, titleOf, wordCount } from '../lib/format.js';
import { Markdown } from './Markdown.jsx';
import { Button, Card, Tag, useToast } from './ui.jsx';

/** Shown while an agent is running: plain status, a timer, and quiet placeholder lines. */
export function WorkingCard({ agent }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [agent]);

  const meta = AGENT[agent] || { label: 'The agent', doing: 'is working' };
  const widths = ['w-2/5', 'w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/5'];

  return (
    <Card className="rise p-6 sm:p-8" aria-busy="true">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">
        {meta.label} {meta.doing}…
      </h2>
      <p className="mt-1 text-sm text-muted">{seconds}s elapsed. This page updates by itself, so you can leave and come back.</p>
      <div className="mt-7 space-y-3" aria-hidden="true">
        {widths.map((w, i) => (
          <div key={i} className={`h-3 animate-pulse rounded-full bg-sunken ${w}`} style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </Card>
  );
}

export function ErrorCard({ project, busy, onRetry }) {
  const start = project.status === 'failed_to_start';
  return (
    <Card className="rise border-danger/40 p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-danger">{start ? "We couldn't start this run" : 'An AI step failed'}</h2>
      <p className="mt-2 max-w-xl text-muted">
        Nothing is lost: every version and your feedback are saved. {start ? 'The AI service may be restarting.' : 'This is usually a temporary provider error or a rate limit.'}
      </p>
      <Button className="mt-5" variant="primary" icon={RefreshCw} loading={busy} onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

export function FinalCard({ project, version }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const title = titleOf(version.content, project.topic);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(version.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not access the clipboard.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([version.content], { type: 'text/markdown' }));
    const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blog';
    Object.assign(document.createElement('a'), { href: url, download: `${name}.md` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Your blog is ready</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Tag>{wordCount(version.content)} words</Tag>
            <Tag>{readMinutes(version.content)} min read</Tag>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? 'Copied' : 'Copy markdown'}
          </Button>
          <Button variant="outline" size="sm" icon={Download} onClick={download}>
            Download .md
          </Button>
        </div>
      </div>
      <article className="mt-6 rounded-lg border border-line bg-surface px-6 py-10 sm:px-14 sm:py-14">
        <div className="mx-auto max-w-[40rem]">
          <Markdown className="prose-lg">{version.content}</Markdown>
        </div>
      </article>
    </section>
  );
}
