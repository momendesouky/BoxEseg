const User = require('../models/User');
const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByEmail(email, includePassword = false) {
    const query = this.model.findOne({ email: email.toLowerCase() });
    return includePassword ? query.select('+passwordHash') : query;
  }

  findByProvider(provider, providerId) {
    return this.model.findOne({ provider, providerId });
  }

  list({ filter = {}, skip = 0, limit = 20, sort = '-createdAt' }) {
    return this.model.find(filter).sort(sort).skip(skip).limit(limit);
  }

  markLogin(userId) {
    return this.model.findByIdAndUpdate(userId, { lastLoginAt: new Date() }, { new: true });
  }
}

module.exports = UserRepository;
