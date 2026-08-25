const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const dimensionSchema = new mongoose.Schema(
  {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    thickness: { type: Number, min: 0 },
    unit: { type: String, enum: ['mm', 'cm', 'm'], default: 'mm' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: false, uppercase: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    material: {
      type: String,
      enum: ['MDF', 'PLYWOOD', 'PVC', 'HPL', 'WOOD_PANEL', 'OTHER'],
      default: 'MDF',
      index: true,
    },
    description: { type: String, trim: true, maxlength: 4000 },
    shortDescription: { type: String, trim: true, maxlength: 280 },
    dimensions: dimensionSchema,
    images: [imageSchema],
    price: { type: Number, required: true, min: 0, index: true },
    compareAtPrice: { type: Number, min: 0 },
    cost: { type: Number, min: 0, select: false },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
    featured: { type: Boolean, default: false, index: true },
    tags: [{ type: String, trim: true }],
    attributes: {
      finish: { type: String, trim: true },
      grade: { type: String, trim: true },
      color: { type: String, trim: true },
      usage: { type: String, trim: true },
    },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewsCount: { type: Number, min: 0, default: 0 },
    weightKg: { type: Number, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ name: 'text', description: 'text', tags: 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);
