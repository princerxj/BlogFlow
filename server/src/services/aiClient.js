// Thin HTTP client for the Python AI service (chunk 1). Knows nothing about MongoDB.
import { config } from '../config.js';

/** The AI service answered with an HTTP error. */
export class AiHttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

/** The AI service could not be reached (down, DNS, timeout). We cannot know if it processed anything. */
export class AiUnreachableError extends Error {}

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  let res;
  try {
    res = await fetch(`${config.ai.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(config.ai.internalKey && { 'X-Internal-Key': config.ai.internalKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new AiUnreachableError(err.name === 'AbortError' ? 'AI service timed out' : 'AI service unreachable');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AiHttpError(res.status, data?.detail ?? res.statusText);
  return data;
}

export const aiClient = {
  start: (payload) => request('POST', '/runs', payload),
  get: (threadId) => request('GET', `/runs/${threadId}`),
  resume: (threadId, { action, feedback }) =>
    request('POST', `/runs/${threadId}/resume`, { action, feedback: feedback ?? '' }),
  retry: (threadId) => request('POST', `/runs/${threadId}/retry`),
};
