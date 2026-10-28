const mongoose = require('mongoose');

// Remembers which Telegram chat belongs to each verified phone number so
// repeat guests get OTP codes / confirmations sent automatically — the
// bot-linking step is only needed the very first time.
const telegramContactSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    chatId: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TelegramContact', telegramContactSchema);
