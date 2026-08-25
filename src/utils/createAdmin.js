require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../config/database');
const container = require('../config/container');
const logger = require('./logger');

async function createAdmin() {
  await connectDatabase();

  const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3];
  const firstName = process.env.ADMIN_FIRST_NAME || process.argv[4] || 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME || process.argv[5] || 'User';

  if (!email || !password || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or pass email and password as arguments.');
  }

  const existingUser = await container.userRepository.findByEmail(email);
  if (existingUser) {
    await container.userRepository.updateById(existingUser.id, { role: 'admin', isActive: true });
    logger.info(`Promoted ${email} to admin`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await container.userRepository.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role: 'admin',
    provider: 'local',
    isActive: true,
  });

  logger.info(`Created admin ${email}`);
  process.exit(0);
}

createAdmin().catch((error) => {
  logger.error('Admin creation failed', error);
  process.exit(1);
});
