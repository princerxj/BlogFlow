import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimits.js';
import { validate } from '../middleware/validate.js';
import { Project } from '../models/Project.js';
import { Version } from '../models/Version.js';
import { projectView, serializeVersions } from '../services/projectView.js';
import { createProject, resumeProject, retryProject, syncProject } from '../services/workflow.js';

const router = Router();
router.use(requireAuth); // every project route needs a logged-in user

// Keep in sync with SUPPORTED_PROVIDERS in the AI service (app/llm.py).
const createSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  audience: z.string().trim().max(200).optional(),
  provider: z.enum(['groq', 'openai', 'anthropic']).optional(),
  model: z.string().trim().max(100).optional(),
  temperature: z.number().min(0).max(1.5).optional(),
});

const resumeSchema = z
  .object({
    action: z.enum(['approve', 'revise']),
    feedback: z.string().trim().max(4000).optional(),
  })
  .refine((d) => d.action !== 'revise' || !!d.feedback, {
    message: 'feedback is required when action is "revise"',
    path: ['feedback'],
  });

// Load :id once for every route that has it. Scoped to the owner, so someone else's
// project looks exactly like a missing one (404), never "forbidden".
router.param('id', async (req, res, next, id) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError(404, 'Project not found');
    const project = await Project.findOne({ _id: id, owner: req.user.id });
    if (!project) throw new AppError(404, 'Project not found');
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Steps run in the background: respond 202 now, progress arrives over Socket.IO.
 * `?wait=true` blocks until the step finishes instead (for scripts, curl and tests):
 * it returns the final state, or the same error the step failed with.
 */
async function respond(req, res, { project, done }, okStatus) {
  if (req.query.wait === 'true') {
    const { error } = await done;
    if (error) throw error;
    return res.status(okStatus).json(await projectView(project));
  }
  return res.status(202).json(await projectView(project));
}

router.post('/', llmLimiter, validate(createSchema), async (req, res) => {
  const count = await Project.countDocuments({ owner: req.user.id });
  if (count >= config.limits.maxProjectsPerUser) {
    throw new AppError(403, `Project limit reached (${config.limits.maxProjectsPerUser}). Delete one to create another.`);
  }
  await respond(req, res, await createProject(req.body, req.user.id), 201);
});

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const filter = { owner: req.user.id };
  if (typeof req.query.status === 'string') filter.status = req.query.status;
  const [projects, total] = await Promise.all([
    Project.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);
  res.json({ projects, page, limit, total });
});

router.get('/:id', async (req, res) => {
  res.json(await projectView(req.project));
});

router.get('/:id/versions', async (req, res) => {
  const versions = await Version.find({ project: req.project._id }).sort({ createdAt: 1, number: 1 }).lean();
  res.json({ versions: serializeVersions(versions) });
});

router.post('/:id/resume', llmLimiter, validate(resumeSchema), async (req, res) => {
  await respond(req, res, await resumeProject(req.project, req.body), 200);
});

router.post('/:id/retry', llmLimiter, async (req, res) => {
  await respond(req, res, await retryProject(req.project), 200);
});

router.post('/:id/sync', async (req, res) => {
  await syncProject(req.project);
  res.json(await projectView(req.project));
});

// Removes our data. The AI service keeps its checkpoint for this thread (harmless; see README).
router.delete('/:id', async (req, res) => {
  await Version.deleteMany({ project: req.project._id });
  await req.project.deleteOne();
  res.status(204).end();
});

export default router;
