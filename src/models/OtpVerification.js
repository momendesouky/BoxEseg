const mongoose = require('mongoose');

// One row per issued code. Verifying consumes the row; rows are auto-deleted
// by the TTL index once their expiry passes.
const otpVerificationSchema = new mongoose.Schema(
  {
    contactType: { type: String, enum: ['email', 'phone'], required: true },
    contact: { type: String, required: true, trim: true, lowercase: true },
    purpose: { type: String, enum: ['checkout', 'track'], required: true },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    verifiedAt: { type: Date },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

otpVerificationSchema.index({ contactType: 1, contact: 1, purpose: 1, consumedAt: 1 });
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
