const TelegramContact = require('../models/TelegramContact');

class TelegramContactRepository {
  findByPhone(phone) {
    return TelegramContact.findOne({ phone }).lean();
  }

  upsert(phone, chatId, firstName = '') {
    return TelegramContact.findOneAndUpdate(
      { phone },
      { $set: { phone, chatId, firstName, lastUsedAt: new Date() } },
      { upsert: true, new: true }
    );
  }

  remove(phone) {
    return TelegramContact.deleteOne({ phone });
  }
}

module.exports = TelegramContactRepository;
