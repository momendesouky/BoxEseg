const mongoose = require('mongoose');

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    street: { type: String, required: true, trim: true },
    building: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: false, trim: true },
    image: { type: String, trim: true },
    material: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    cutNotes: { type: String, trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],
    shippingAddress: addressSnapshotSchema,
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    paymentMethod: { type: String, enum: ['cod', 'paymob_card', 'paymob_wallet'], required: true },
    payment: {
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      provider: { type: String, trim: true },
      transactionId: { type: String, trim: true },
      iframeUrl: { type: String, trim: true },
      walletToken: { type: String, trim: true },
      paymobTransactionId: { type: String, trim: true },
      raw: { type: mongoose.Schema.Types.Mixed },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    invoice: {
      number: { type: String, trim: true },
      path: { type: String, trim: true },
      generatedAt: { type: Date },
    },
    placedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
