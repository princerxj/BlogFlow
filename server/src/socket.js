/**
 * Socket.IO server: pushes workflow progress to the owner of a project.
 *
 * Client:  io(API_URL, { auth: (cb) => cb({ token: getAccessToken() }) })
 *          socket.on('project:event', (e) => ...)      // see README for the event shapes
 *
 * Security:
 *  - the handshake must carry a valid access token (same JWT as the REST API);
 *  - every user is put in a private room, and events are only emitted to the owner's room;
 *  - a connection is closed when its token expires (after sending `auth:expired`), so a
 *    long-lived socket cannot outlive the session. The client refreshes its token and reconnects.
 */
import { Server } from 'socket.io';
import { config } from './config.js';
import { setEmitter } from './services/events.js';
import { verifyAccessToken } from './services/tokens.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
    serveClient: false,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.exp = payload.exp;
      next();
    } catch (err) {
      next(new Error(err.name === 'TokenExpiredError' ? 'token_expired' : 'unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    const msLeft = Math.max(socket.data.exp * 1000 - Date.now(), 0);
    const timer = setTimeout(() => {
      socket.emit('auth:expired');
      socket.disconnect(true);
    }, msLeft);
    socket.on('disconnect', () => clearTimeout(timer));
  });

  setEmitter((userId, event) => io.to(`user:${userId}`).emit('project:event', event));
  return io;
}
