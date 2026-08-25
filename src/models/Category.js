const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 600 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
