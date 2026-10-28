const OtpVerification = require('../models/OtpVerification');
const BaseRepository = require('./BaseRepository');

class OtpVerificationRepository extends BaseRepository {
  constructor() {
    super(OtpVerification);
  }

  findActive(contactType, contact, purpose) {
    return this.model
      .findOne({
        contactType,
        contact,
        purpose,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .select('+codeHash');
  }

  invalidateFor(contactType, contact, purpose) {
    return this.model.updateMany(
      { contactType, contact, purpose, consumedAt: null },
      { consumedAt: new Date() }
    );
  }

  findMostRecent(contactType, contact, purpose) {
    return this.model
      .findOne({ contactType, contact, purpose })
      .sort('-lastSentAt');
  }
}

module.exports = OtpVerificationRepository;
