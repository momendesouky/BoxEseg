const Wishlist = require('../models/Wishlist');
const BaseRepository = require('./BaseRepository');

class WishlistRepository extends BaseRepository {
  constructor() {
    super(Wishlist);
  }

  findByUser(userId) {
    return this.model.findOne({ user: userId }).populate('products');
  }

  findOrCreateByUser(userId) {
    return this.model.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, products: [] } },
      { new: true, upsert: true }
    ).populate('products');
  }
}

module.exports = WishlistRepository;
