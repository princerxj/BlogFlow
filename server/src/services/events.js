// Tiny pub/sub seam between the workflow (which knows nothing about sockets) and Socket.IO.
// Without a registered emitter (e.g. in scripts) events are silently dropped.
let emitter = () => {};

export const setEmitter = (fn) => {
  emitter = fn;
};

/** Send a project event to every open connection of one user. Never throws. */
export function emitToUser(userId, event) {
  try {
    emitter(String(userId), event);
  } catch (err) {
    console.error('event emit failed:', err.message);
  }
}
