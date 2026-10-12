import mongoose from 'mongoose';

/**
 * Immutable snapshot of one agent output.
 *
 *   research v1 --(human feedback)--> research v2 --> draft v1 --(feedback)--> draft v2 --> final v1
 *
 * `feedback` is the human feedback that CAUSED this version (null for first attempts).
 * `decision` records what the human did with it.
 */
const versionSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    kind: { type: String, enum: ['research', 'draft', 'final'], required: true },
    number: { type: Number, required: true, min: 1 },
    content: { type: String, required: true },
    feedback: { type: String, default: null },
    decision: { type: String, enum: ['pending', 'approved', 'revised', 'final'], default: 'pending' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Makes syncing idempotent: the same AI output can never be stored twice.
versionSchema.index({ project: 1, kind: 1, number: 1 }, { unique: true });
versionSchema.index({ project: 1, createdAt: 1 });

export const Version = mongoose.model('Version', versionSchema);
