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
