const AppError = require('../utils/AppError');

class ReviewService {
  constructor({ reviewRepository, productRepository }) {
    this.reviewRepository = reviewRepository;
    this.productRepository = productRepository;
  }

  async listForProduct(productId) {
    return this.reviewRepository.listForProduct(productId);
  }

  async create(userId, productId, payload) {
    const existingReview = await this.reviewRepository.findByUserAndProduct(userId, productId);
    if (existingReview) {
      throw new AppError('You already reviewed this product.', 409);
    }

    const review = await this.reviewRepository.create({
      user: userId,
      product: productId,
      rating: Number(payload.rating),
      title: payload.title,
      comment: payload.comment,
    });

    await this.refreshProductRating(productId);
    return review;
  }

  async refreshProductRating(productId) {
    const [stats] = await this.reviewRepository.ratingStats(productId);
    await this.productRepository.updateRating(
      productId,
      stats?.averageRating || 0,
      stats?.reviewsCount || 0
    );
  }
}

module.exports = ReviewService;
