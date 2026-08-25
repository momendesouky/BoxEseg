const Cart = require('../models/Cart');
const BaseRepository = require('./BaseRepository');

class CartRepository extends BaseRepository {
  constructor() {
    super(Cart);
  }

  findByUser(userId) {
    return this.model.findOne({ user: userId }).populate('items.product');
  }

  findOrCreateByUser(userId) {
    return this.model.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, items: [] } },
      { new: true, upsert: true }
    ).populate('items.product');
  }

  clear(userId, options = {}) {
    return this.model.findOneAndUpdate(
      { user: userId },
      { items: [], couponCode: null },
      { new: true, ...options }
    );
  }
}

module.exports = CartRepository;
