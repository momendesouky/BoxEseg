const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 60 },
    fullName: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    city: { type: String, trim: true, maxlength: 80 },
    area: { type: String, trim: true, maxlength: 100 },
    street: { type: String, trim: true, maxlength: 180 },
    building: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 300 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    phone: { type: String, trim: true, maxlength: 30 },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    isActive: { type: Boolean, default: true, index: true },
    provider: { type: String, enum: ['local', 'facebook', 'google'], default: 'local' },
    providerId: { type: String, index: true },
    avatar: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    addresses: [addressSchema],
    emailVerifiedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 });

module.exports = mongoose.model('User', userSchema);
