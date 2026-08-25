const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is required. Add it to your .env file.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('MongoDB connected');
}

module.exports = { connectDatabase };
