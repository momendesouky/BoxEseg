const PasswordResetToken = require('../models/PasswordResetToken');
const BaseRepository = require('./BaseRepository');

class PasswordResetTokenRepository extends BaseRepository {
  constructor() {
    super(PasswordResetToken);
  }

  findValid(tokenHash) {
    return this.model.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  markUsed(id) {
    return this.model.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true });
  }

  deleteForUser(userId) {
    return this.model.deleteMany({ user: userId });
  }
}

module.exports = PasswordResetTokenRepository;
