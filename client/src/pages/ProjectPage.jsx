import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AgentStepper } from '../components/AgentStepper.jsx';
import { ReviewPanel } from '../components/ReviewPanel.jsx';
import { ErrorCard, FinalCard, WorkingCard } from '../components/StateCards.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Button, Card, Skeleton, useToast } from '../components/ui.jsx';
import { HistoryCard } from '../components/VersionHistory.jsx';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useProjectEvents, useSocketStatus } from '../lib/socket.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const toast = useToast();
  const { connected } = useSocketStatus();
  const [view, setView] = useState(null); // { project, pendingVersion, finalVersion }
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, h] = await Promise.all([api.getProject(id), api.getVersions(id)]);
      setView(v);
      setVersions(h.versions);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    setView(null);
    load();
  }, [load]);

  // Live updates. step_completed carries the full state; versions are re-fetched for the timeline.
  useProjectEvents((e) => {
    if (e.type === 'resync') return load();
    if (e.projectId !== id) return undefined;
    if (e.type === 'step_started') {
      setView((v) => v && { ...v, pendingVersion: null, project: { ...v.project, status: 'running', activeAgent: e.agent } });
    } else if (e.type === 'step_completed') {
      setView({ project: e.project, pendingVersion: e.pendingVersion, finalVersion: e.finalVersion });
      api.getVersions(id).then((h) => setVersions(h.versions)).catch(() => {});
    } else if (e.type === 'step_failed') {
      toast.error(e.message);
      load();
    }
    return undefined;
  });

  // Safety net: while an agent runs, poll (faster if the socket is down) in case an event is missed.
  const running = view?.project.status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(load, connected ? 6000 : 2000);
    return () => clearInterval(t);
  }, [running, connected, load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      setView(await fn());
      api.getVersions(id).then((h) => setVersions(h.versions)).catch(() => {});
      return true;
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const previous = useMemo(() => {
    const v = view?.pendingVersion;
    return v ? versions.find((x) => x.kind === v.kind && x.number === v.number - 1) : null;
  }, [view, versions]);

  if (error && !view) {
    return (
      <Card className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-serif text-2xl font-semibold">{error.status === 404 ? 'Project not found' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-muted">{error.status === 404 ? 'It may have been deleted.' : error.message}</p>
        <Link to="/projects" className="mt-6 inline-block">
          <Button variant="outline">Back to your blogs</Button>
        </Link>
      </Card>
    );
  }

  if (!view) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { project, pendingVersion, finalVersion } = view;
  const meta = [`For ${project.audience}`, project.provider ? `${project.provider}${project.model ? ` / ${project.model}` : ''}` : 'Default model', `Started ${timeAgo(project.createdAt)}`];

  return (
    <div className="rise">
      <Link to="/projects" className="text-sm text-muted hover:text-ink">
        ← All blogs
      </Link>

      <h1 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{project.topic}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <StatusBadge status={project.status} />
        {meta.map((m) => (
          <span key={m} className="sm:before:mr-3 sm:before:text-faint sm:before:content-['·']">
            {m}
          </span>
        ))}
      </p>

      <div className="mt-9 rounded-lg border border-line bg-surface px-3 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <AgentStepper project={project} />
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div aria-live="polite">
          {project.status === 'running' && <WorkingCard agent={project.activeAgent} />}
          {project.status === 'awaiting_review' && pendingVersion && (
            <ReviewPanel
              key={pendingVersion._id}
              project={project}
              version={pendingVersion}
              previous={previous}
              busy={busy}
              onApprove={() => act(() => api.resume(id, { action: 'approve' }))}
              onRevise={(feedback) => act(() => api.resume(id, { action: 'revise', feedback }))}
            />
          )}
          {project.status === 'awaiting_review' && !pendingVersion && (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted">Loading the latest version…</p>
              <Button className="mt-4" variant="outline" onClick={load}>
                Refresh
              </Button>
            </Card>
          )}
          {project.status === 'completed' && finalVersion && <FinalCard project={project} version={finalVersion} />}
          {(project.status === 'stalled' || project.status === 'failed_to_start') && (
            <ErrorCard project={project} busy={busy} onRetry={() => act(() => api.retry(id))} />
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <HistoryCard versions={versions} />
        </aside>
      </div>
    </div>
  );
}
