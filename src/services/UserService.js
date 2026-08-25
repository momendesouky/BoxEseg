const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

class UserService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async list(query = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.role) filter.role = query.role;
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'disabled') filter.isActive = false;

    const [users, total] = await Promise.all([
      this.userRepository.list({ filter, skip, limit }),
      this.userRepository.count(filter),
    ]);

    return { users, pagination: buildPaginationMeta({ page, limit, total }) };
  }

  async updateProfile(userId, payload) {
    const user = await this.userRepository.updateById(userId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return user;
  }

  async updatePassword(userId, payload) {
    const user = await this.userRepository.findById(userId, '+passwordHash');

    if (!user || !user.passwordHash) {
      throw new AppError('Password cannot be changed for this account.', 400);
    }

    const matches = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!matches) {
      throw new AppError('Current password is incorrect.', 400);
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    return this.userRepository.updateById(userId, { passwordHash });
  }

  async updateUserStatus(userId, payload) {
    const user = await this.userRepository.updateById(userId, {
      role: payload.role,
      isActive: payload.isActive === 'true',
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return user;
  }
}

module.exports = UserService;
