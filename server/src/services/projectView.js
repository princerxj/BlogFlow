import { Version } from '../models/Version.js';

/** Stable response shape: optional fields are always present (null), whatever the DB stored. */
const serializeVersion = (v) => (v ? { ...v, feedback: v.feedback ?? null } : null);

export const serializeVersions = (versions) => versions.map(serializeVersion);

/** What the UI needs to render a project: the project, what to review now, and the final blog. */
export async function projectView(project) {
  const [pendingVersion, finalVersion] = await Promise.all([
    project.status === 'awaiting_review'
      ? Version.findOne({ project: project._id, decision: 'pending' }).sort({ createdAt: -1 }).lean()
      : null,
    project.status === 'completed' ? Version.findOne({ project: project._id, kind: 'final' }).lean() : null,
  ]);
  return {
    project: project.toObject(),
    pendingVersion: serializeVersion(pendingVersion),
    finalVersion: serializeVersion(finalVersion),
  };
}
