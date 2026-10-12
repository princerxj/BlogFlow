import mongoose from 'mongoose';

/**
 * One blog-generation run. `_id` doubles as the LangGraph thread_id, so there is
 * no separate mapping to keep in sync.
 *
 * MongoDB owns the product data and history; the AI service's checkpoint owns the
 * workflow position. `status`/`stage` here are a cached mirror of the latter.
 */
const projectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    audience: { type: String, default: 'General reader', trim: true, maxlength: 200 },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    temperature: { type: Number, default: null },

    // running          -> an agent is working in the background (see activeAgent)
    // starting         -> legacy/unused marker, treated like failed_to_start by /retry
    // failed_to_start  -> AI service unreachable on start; POST /retry starts it again
    // awaiting_review  -> paused for a human decision
    // stalled          -> an LLM step failed in the AI service; POST /retry continues it
    // completed        -> final blog ready
    status: {
      type: String,
      enum: ['starting', 'running', 'failed_to_start', 'awaiting_review', 'stalled', 'completed'],
      default: 'running',
      index: true,
    },
    stage: { type: String, default: null }, // researcher_review | draft_review | null
    // The agent currently running (status 'running') or the one that failed (status 'stalled').
    activeAgent: { type: String, enum: ['researcher', 'writer', 'editor', null], default: null },
    researchRevisions: { type: Number, default: 0 },
    draftRevisions: { type: Number, default: 0 },
    maxRevisions: { type: Number, default: null },

    // Feedback the human just gave, waiting to be attached to the version it produces.
    // Persisted before calling the AI service so a timeout or failed step cannot lose it.
    pendingFeedback: { type: String, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ owner: 1, updatedAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
