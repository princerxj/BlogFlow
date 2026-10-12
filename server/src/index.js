import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { Project } from './models/Project.js';
import { RefreshToken } from './models/RefreshToken.js';
import { User } from './models/User.js';
import { recoverInterruptedRuns } from './services/workflow.js';
import { attachSocket } from './socket.js';
import { Version } from './models/Version.js';

await mongoose.connect(config.mongoUri);
await Promise.all([User.init(), RefreshToken.init(), Project.init(), Version.init()]); // build indexes (unique email, tokens, versions)

const server = app.listen(config.port, () => console.log(`API listening on :${config.port}`));
const io = attachSocket(server);

recoverInterruptedRuns()
  .then((n) => n && console.log(`Recovered ${n} interrupted run(s)`))
  .catch((err) => console.error('Run recovery failed:', err.message));

async function shutdown() {
  io.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
