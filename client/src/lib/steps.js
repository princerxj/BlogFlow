// Turns a project's status into the 5 nodes of the workflow diagram:
//   Researcher -> (your review) -> Writer -> (your review) -> Editor
export const STEP_ORDER = ['researcher', 'review_research', 'writer', 'review_draft', 'editor'];
const AGENT_INDEX = { researcher: 0, writer: 2, editor: 4 };

/** state: done | active (agent working) | waiting (needs the human) | error | pending */
export function deriveSteps(project) {
  const { status, stage, activeAgent } = project;
  let current = 0;
  let mode = 'active';

  if (status === 'completed') current = STEP_ORDER.length;
  else if (status === 'awaiting_review') {
    current = stage === 'draft_review' ? 3 : 1;
    mode = 'waiting';
  } else if (status === 'running') current = AGENT_INDEX[activeAgent] ?? 0;
  else if (status === 'stalled') {
    current = AGENT_INDEX[activeAgent] ?? 0;
    mode = 'error';
  } else mode = 'error'; // failed_to_start

  return STEP_ORDER.map((key, index) => ({
    key,
    index,
    state: index < current ? 'done' : index === current ? mode : 'pending',
  }));
}
