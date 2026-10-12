/**
 * Orchestration between MongoDB (history, product data) and the AI service (workflow state).
 *
 * Every AI step runs IN THE BACKGROUND: the HTTP request returns 202 immediately and progress is
 * pushed over Socket.IO (step_started -> step_completed | step_failed). Each public function
 * returns { project, done }: `done` always resolves to { error } (never rejects), so callers may
 * await it (?wait=true) or ignore it.
 *
 * Rules that keep the two databases consistent:
 *  - A project is "claimed" with an atomic compare-and-set (status -> running). That is the lock:
 *    two simultaneous submits cannot both win.
 *  - After every AI call we "apply" its response idempotently (unique-index upsert of the Version,
 *    refresh of the Project), so /retry and /sync can safely re-apply at any time.
 *  - The human's feedback is persisted (pendingFeedback) before the AI call, so no failure loses it.
 */
import { AppError } from '../errors.js';
import { Project } from '../models/Project.js';
import { Version } from '../models/Version.js';
import { aiClient, AiHttpError, AiUnreachableError } from './aiClient.js';
import { emitToUser } from './events.js';
import { projectView } from './projectView.js';

const REVIEW_KIND = { researcher_review: 'research', draft_review: 'draft' };
const NODE_TO_AGENT = { research: 'researcher', writer: 'writer', edit: 'editor' };

/** Which agent runs next, given the review the human is answering. */
function agentFor(stage, action) {
  if (stage === 'researcher_review') return action === 'approve' ? 'writer' : 'researcher';
  if (stage === 'draft_review') return action === 'approve' ? 'editor' : 'writer';
  return null;
}

/** Translate AI-service failures into safe, client-facing errors (never leak internals). */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof AiUnreachableError) return new AppError(503, 'The AI service is unavailable. Try again shortly.');
  if (err instanceof AiHttpError) {
    if (err.status === 409) return new AppError(409, err.message); // safe, written by us
    if (err.status === 422) return new AppError(400, 'The AI service rejected the request');
    if (err.status === 502) return new AppError(502, 'An AI step failed. Your progress is saved; use retry.');
    return new AppError(502, 'Unexpected response from the AI service');
  }
  return err;
}

// ------------------------------------------------------------------ events
const pid = (project) => String(project._id);

function emitStarted(project) {
  emitToUser(project.owner, { type: 'step_started', projectId: pid(project), status: 'running', agent: project.activeAgent });
}

async function emitCompleted(project) {
  emitToUser(project.owner, { type: 'step_completed', projectId: pid(project), ...(await projectView(project)) });
}

function emitFailed(project, message, status) {
  emitToUser(project.owner, {
    type: 'step_failed',
    projectId: pid(project),
    status,
    agent: project.activeAgent,
    message,
    retryable: status === 'stalled' || status === 'failed_to_start',
  });
}

// ---------------------------------------------------------------- persistence
async function upsertVersion(projectId, kind, number, content, feedback) {
  if (!content) return;
  try {
    await Version.updateOne(
      { project: projectId, kind, number },
      { $setOnInsert: { content, feedback: feedback ?? null, decision: kind === 'final' ? 'final' : 'pending' } },
      { upsert: true },
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // duplicate key = a concurrent request already stored it
  }
}

/** Mark what the human did with the version currently under review. Call BEFORE applyAiResult. */
async function recordDecision(project, action) {
  const kind = REVIEW_KIND[project.stage];
  if (!kind) return;
  const number = (kind === 'research' ? project.researchRevisions : project.draftRevisions) + 1;
  await Version.updateOne(
    { project: project._id, kind, number },
    { decision: action === 'approve' ? 'approved' : 'revised' },
  );
}

/** Store the AI service's latest output and refresh the cached project state. Idempotent. */
async function applyAiResult(project, ai, { announce = true } = {}) {
  const s = ai.state;
  const feedback = project.pendingFeedback;

  if (ai.status === 'awaiting_review') {
    if (ai.stage === 'researcher_review') {
      await upsertVersion(project._id, 'research', (s.research_revision_count ?? 0) + 1, ai.review.research, feedback);
    } else if (ai.stage === 'draft_review') {
      await upsertVersion(project._id, 'draft', (s.revision_count ?? 0) + 1, ai.review.draft, feedback);
    }
  } else if (ai.status === 'completed') {
    await upsertVersion(project._id, 'final', 1, s.final_blog, null);
  }

  project.status = ai.status;
  project.stage = ai.status === 'stalled' ? null : ai.stage;
  project.activeAgent = ai.status === 'stalled' ? (NODE_TO_AGENT[ai.stage] ?? project.activeAgent) : null;
  project.researchRevisions = s.research_revision_count ?? 0;
  project.draftRevisions = s.revision_count ?? 0;
  project.maxRevisions = ai.review?.max_revisions ?? project.maxRevisions;
  project.pendingFeedback = null;
  await project.save();

  if (!announce) return;
  if (project.status === 'stalled') emitFailed(project, 'An AI step failed. Your progress is saved; use retry.', 'stalled');
  else await emitCompleted(project);
}

// ------------------------------------------------------------ step execution
async function failStep(project, err, status) {
  const appErr = toAppError(err);
  const known = appErr instanceof AppError;
  if (!known) console.error('Unexpected workflow error:', err);
  const error = known ? appErr : new AppError(500, 'Internal server error');
  error.extra = { ...error.extra, projectId: pid(project) }; // lets the client retry/inspect this project

  try {
    project.status = status;
    if (status === 'stalled') project.stage = null;
    if (status === 'awaiting_review') {
      project.activeAgent = null;
      project.pendingFeedback = null; // the decision was NOT applied
    }
    await project.save();
  } catch (saveErr) {
    console.error('Could not persist failure state:', saveErr.message);
  }
  emitFailed(project, error.message, status);
  return { error };
}

/** The AI service disagrees with us (e.g. 409): adopt its state, then tell the user their action didn't apply. */
async function reconcileAfter(project, originalErr, fallbackStatus) {
  try {
    const ai = await aiClient.get(pid(project));
    await applyAiResult(project, ai, { announce: false });
    const error = toAppError(originalErr);
    error.extra = { ...error.extra, projectId: pid(project) };
    emitFailed(project, error.message, project.status);
    if (project.status !== 'stalled') await emitCompleted(project); // refresh the UI with the corrected state
    return { error };
  } catch {
    return failStep(project, originalErr, fallbackStatus);
  }
}

/**
 * Run one AI call and settle the project. Never throws.
 *  call            -> performs the AI request
 *  onAccepted      -> runs once the AI service accepted our input (success OR a failed LLM step)
 *  unreachableStatus -> status to leave the project in if the AI service can't be reached
 */
async function runStep(project, { call, onAccepted, unreachableStatus }) {
  try {
    let ai;
    try {
      ai = await call();
    } catch (err) {
      if (err instanceof AiHttpError && err.status === 502) {
        if (onAccepted) await onAccepted();
        return await failStep(project, err, 'stalled');
      }
      if (err instanceof AiHttpError) return await reconcileAfter(project, err, unreachableStatus);
      return await failStep(project, err, unreachableStatus);
    }
    if (onAccepted) await onAccepted();
    await applyAiResult(project, ai);
    return { error: null };
  } catch (err) {
    return failStep(project, err, 'stalled');
  }
}

/** Start the run; if the AI service already has this thread (e.g. an earlier timeout), adopt it. */
async function startRun(project) {
  try {
    return await aiClient.start({
      thread_id: pid(project),
      topic: project.topic,
      audience: project.audience,
      provider: project.provider,
      model: project.model,
      temperature: project.temperature,
    });
  } catch (err) {
    if (err instanceof AiHttpError && err.status === 409) return aiClient.get(pid(project));
    throw err;
  }
}

// ----------------------------------------------------------------- public API
export async function createProject(input, ownerId) {
  const project = await Project.create({
    owner: ownerId,
    topic: input.topic,
    audience: input.audience || undefined,
    provider: input.provider ?? null,
    model: input.model ?? null,
    temperature: input.temperature ?? null,
    status: 'running',
    activeAgent: 'researcher',
  });
  emitStarted(project);
  const done = runStep(project, { call: () => startRun(project), unreachableStatus: 'failed_to_start' });
  return { project, done };
}

export async function resumeProject(project, { action, feedback }) {
  const agent = agentFor(project.stage, action);
  if (project.status !== 'awaiting_review' || !agent) {
    throw new AppError(409, `Project is not awaiting review (status: ${project.status})`);
  }
  const used = project.stage === 'researcher_review' ? project.researchRevisions : project.draftRevisions;
  if (action === 'revise' && project.maxRevisions != null && used >= project.maxRevisions) {
    throw new AppError(409, 'Revision limit reached for this stage; approve to continue');
  }

  // Atomic compare-and-set = the lock. Persisting feedback here means no later failure can lose it.
  const claimed = await Project.findOneAndUpdate(
    { _id: project._id, owner: project.owner, status: 'awaiting_review' },
    { status: 'running', activeAgent: agent, pendingFeedback: action === 'revise' ? feedback : null },
    { returnDocument: 'after' },
  );
  if (!claimed) throw new AppError(409, 'This project is already processing a request');

  emitStarted(claimed);
  const done = runStep(claimed, {
    call: () => aiClient.resume(pid(claimed), { action, feedback }),
    onAccepted: () => recordDecision(claimed, action),
    unreachableStatus: 'awaiting_review',
  });
  return { project: claimed, done };
}

export async function retryProject(project) {
  const wasStalled = project.status === 'stalled';
  const claimed = await Project.findOneAndUpdate(
    { _id: project._id, owner: project.owner, status: { $in: ['stalled', 'failed_to_start', 'starting'] } },
    { status: 'running', activeAgent: project.activeAgent || 'researcher' },
    { returnDocument: 'after' },
  );
  if (!claimed) throw new AppError(409, `Nothing to retry (status: ${project.status})`);

  emitStarted(claimed);
  const done = runStep(claimed, {
    call: () => (wasStalled ? aiClient.retry(pid(claimed)) : startRun(claimed)),
    unreachableStatus: wasStalled ? 'stalled' : 'failed_to_start',
  });
  return { project: claimed, done };
}

/** Re-read the AI service's truth and repair MongoDB (e.g. after a timeout of unknown outcome). */
export async function syncProject(project) {
  if (project.status === 'running') throw new AppError(409, 'A step is in progress; wait for it to finish');
  try {
    await applyAiResult(project, await aiClient.get(pid(project)));
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Boot-time recovery: a crash mid-step leaves projects stuck in "running" with nobody working on them.
 * Adopt whatever the AI service says. (If the AI service is itself still mid-step it will report the
 * previous review state; a later /sync or the next action reconciles once it finishes.)
 */
export async function recoverInterruptedRuns() {
  const stuck = await Project.find({ status: 'running' });
  for (const project of stuck) {
    try {
      await applyAiResult(project, await aiClient.get(pid(project)));
    } catch (err) {
      const neverStarted = err instanceof AiHttpError && err.status === 404;
      project.status = neverStarted ? 'failed_to_start' : 'stalled';
      project.pendingFeedback = null;
      await project.save();
      emitFailed(project, 'The server restarted during this step. Use retry.', project.status);
    }
  }
  return stuck.length;
}
