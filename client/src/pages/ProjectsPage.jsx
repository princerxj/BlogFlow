import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NewBlogModal } from '../components/NewBlogModal.jsx';
import { MiniProgress, StatusBadge } from '../components/StatusBadge.jsx';
import { Button, EmptyState, Skeleton, cx, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import { useProjectEvents } from '../lib/socket.jsx';

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'review', label: 'Needs review', match: (p) => p.status === 'awaiting_review' },
  { key: 'working', label: 'Working', match: (p) => p.status === 'running' },
  { key: 'done', label: 'Completed', match: (p) => p.status === 'completed' },
  { key: 'issues', label: 'Issues', match: (p) => p.status === 'stalled' || p.status === 'failed_to_start' },
];

function Row({ project, onDelete }) {
  return (
    <li className="group flex items-stretch hover:bg-sunken/60">
      <Link to={`/projects/${project._id}`} className="grid min-w-0 flex-1 gap-3 py-5 pl-1 pr-3 sm:grid-cols-[minmax(0,1fr)_7rem_9.5rem] sm:items-center sm:gap-8 sm:pl-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-xl font-medium leading-snug tracking-tight">{project.topic}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">For {project.audience}</p>
        </div>
        <MiniProgress project={project} />
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
          <StatusBadge status={project.status} />
          <span className="text-xs text-faint">{timeAgo(project.updatedAt)}</span>
        </div>
      </Link>
      <button
        onClick={() => onDelete(project)}
        aria-label={`Delete ${project.topic}`}
        className="grid w-10 place-items-center text-faint opacity-100 transition-colors hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
    </li>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [projects, setProjects] = useState(null);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const projectsRef = useRef(null);
  projectsRef.current = projects;

  const load = useCallback(() => api.listProjects().then((d) => setProjects(d.projects)).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  // Keep rows live: a project finishing a step elsewhere updates in place.
  useProjectEvents((e) => {
    if (e.type === 'resync') return load();
    // A project we don't have yet (created in another tab or device): fetch the list.
    if (projectsRef.current && !projectsRef.current.some((p) => p._id === e.projectId)) return load();
    setProjects((list) =>
      list?.map((p) => {
        if (p._id !== e.projectId) return p;
        if (e.type === 'step_completed') return e.project;
        return { ...p, status: e.status ?? p.status, activeAgent: e.agent ?? p.activeAgent };
      }),
    );
    return undefined;
  });

  const remove = async (project) => {
    if (!window.confirm(`Delete "${project.topic}" and all its versions? This cannot be undone.`)) return;
    try {
      await api.deleteProject(project._id);
      setProjects((l) => l.filter((p) => p._id !== project._id));
      toast.success('Project deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (projects || []).filter(f.match).length])), [projects]);
  const visible = (projects || []).filter(FILTERS.find((f) => f.key === filter).match);
  const firstName = (user?.name || user?.email || '').split(/[ @]/)[0];

  return (
    <div className="rise">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm text-muted">Hello, {firstName}</p>
          <h1 className="mt-1 font-serif text-5xl font-semibold leading-none tracking-tight">Your blogs</h1>
          {projects && projects.length > 0 && (
            <p className="mt-4 text-muted">
              <span className={cx(counts.review > 0 && 'font-medium text-accent')}>{counts.review} need your review</span>
              {' · '}
              {counts.working} in progress
              {' · '}
              {counts.done} completed
            </p>
          )}
        </div>
        <Button size="lg" onClick={() => setModal(true)}>
          New blog
        </Button>
      </div>

      <div className="mt-10 flex gap-6 overflow-x-auto border-b border-line" role="tablist" aria-label="Filter projects">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cx('-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors', filter === f.key ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}
          >
            {f.label}
            {projects && <span className="ml-1.5 tabular-nums text-faint">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {projects === null ? (
          <div className="space-y-px">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="my-4 h-14" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No blogs yet" action={<Button size="lg" onClick={() => setModal(true)}>New blog</Button>}>
              Pick a topic and three agents will research, write and edit it. You review every step.
            </EmptyState>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-muted">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((p) => (
              <Row key={p._id} project={p} onDelete={remove} />
            ))}
          </ul>
        )}
      </div>

      <NewBlogModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(view) => {
          setModal(false);
          navigate(`/projects/${view.project._id}`);
        }}
      />
    </div>
  );
}
