const AppError = require('../utils/AppError');

class WishlistService {
  constructor({ wishlistRepository, productRepository }) {
    this.wishlistRepository = wishlistRepository;
    this.productRepository = productRepository;
  }

  async getWishlist(userId) {
    return this.wishlistRepository.findOrCreateByUser(userId);
  }

  async add(userId, productId) {
    const product = await this.productRepository.findActiveById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    const wishlist = await this.wishlistRepository.findOrCreateByUser(userId);
    const exists = wishlist.products.some((item) => item._id.toString() === productId);

    if (!exists) {
      wishlist.products.push(product.id);
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  async remove(userId, productId) {
    const wishlist = await this.wishlistRepository.findOrCreateByUser(userId);
    wishlist.products = wishlist.products.filter((product) => product._id.toString() !== productId);
    await wishlist.save();
    return this.getWishlist(userId);
  }
}

module.exports = WishlistService;
