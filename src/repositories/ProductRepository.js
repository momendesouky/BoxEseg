const Product = require('../models/Product');
const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  findBySlug(slug) {
    return this.model.findOne({ slug }).populate('category', 'name slug');
  }

  findActiveById(id) {
    return this.model.findOne({ _id: id, status: 'active' }).populate('category', 'name slug');
  }

  list({ filter = {}, skip = 0, limit = 12, sort = '-createdAt' } = {}) {
    return this.model.find(filter).populate('category', 'name slug').sort(sort).skip(skip).limit(limit);
  }

  findFeatured(limit = 6) {
    return this.model
      .find({ status: 'active', featured: true })
      .populate('category', 'name slug')
      .sort('-createdAt')
      .limit(limit);
  }

  decrementStock(productId, quantity, options = {}) {
    return this.model.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true, ...options }
    );
  }

  incrementStock(productId, quantity, options = {}) {
    return this.model.findByIdAndUpdate(productId, { $inc: { stock: quantity } }, { new: true, ...options });
  }

  updateRating(productId, averageRating, reviewsCount) {
    return this.model.findByIdAndUpdate(productId, { averageRating, reviewsCount }, { new: true });
  }
}

module.exports = ProductRepository;
