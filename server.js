// dotenv must load before the DNS block below so DNS_SERVERS from .env is visible.
require('dotenv').config();

// DNS fix: Node's Windows raw-DNS backend can't read this PC's real DNS config
// and falls back to 127.0.0.1 (dead), breaking mongodb+srv:// lookups.
// MUST run before ./src/app is required (it starts resolving Mongo's SRV
// record at load time for the MongoStore session store). Only applied when
// DNS_SERVERS is set (dev box: 8.8.8.8,8.8.4.4) so production hosts keep
// their normal resolver behavior.
const PUBLIC_DNS = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (PUBLIC_DNS.length) {
  require('dns').setServers(PUBLIC_DNS);
  require('dns').promises.setServers(PUBLIC_DNS);
  // eslint-disable-next-line no-console -- runs before the logger exists
  console.log(`[dns] overriding resolvers with ${PUBLIC_DNS.join(', ')}`);
}

const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');

async function startServer() {
  try {
    await connectDatabase();
    
    app.listen(env.port, () => {
      logger.info(`BoxEseg running on http://localhost:${env.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
