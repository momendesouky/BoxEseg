const Review = require('../models/Review');
const BaseRepository = require('./BaseRepository');

class ReviewRepository extends BaseRepository {
  constructor() {
    super(Review);
  }

  listForProduct(productId) {
    return this.model
      .find({ product: productId, isApproved: true })
      .populate('user', 'firstName lastName avatar')
      .sort('-createdAt');
  }

  findByUserAndProduct(userId, productId) {
    return this.model.findOne({ user: userId, product: productId });
  }

  ratingStats(productId) {
    return this.model.aggregate([
      { $match: { product: productId, isApproved: true } },
      { $group: { _id: '$product', averageRating: { $avg: '$rating' }, reviewsCount: { $sum: 1 } } },
    ]);
  }
}

module.exports = ReviewRepository;
