const AppError = require('../utils/AppError');

class CartService {
  constructor({ cartRepository, productRepository, couponService }) {
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
    this.couponService = couponService;
  }

  async getCart(userId) {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    const totals = await this.calculateTotals(cart);

    return { cart, totals };
  }

  async addItem(userId, { productId, quantity = 1, cutNotes = '' }) {
    const product = await this.productRepository.findActiveById(productId);

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    const requestedQuantity = Math.max(Number(quantity), 1);
    if (product.stock < requestedQuantity) {
      throw new AppError('Requested quantity is not available in stock.', 400);
    }

    const cart = await this.cartRepository.findOrCreateByUser(userId);
    const existingItem = cart.items.find((item) => item.product._id.toString() === product.id);

    if (existingItem) {
      const nextQuantity = existingItem.quantity + requestedQuantity;
      if (product.stock < nextQuantity) {
        throw new AppError('Requested quantity is not available in stock.', 400);
      }
      existingItem.quantity = nextQuantity;
      existingItem.cutNotes = cutNotes || existingItem.cutNotes;
    } else {
      cart.items.push({
        product: product.id,
        quantity: requestedQuantity,
        unitPrice: product.price,
        cutNotes,
      });
    }

    await cart.save();
    return this.getCart(userId);
  }

  async updateItem(userId, productId, quantity) {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    const item = cart.items.find((cartItem) => cartItem.product._id.toString() === productId);

    if (!item) {
      throw new AppError('Cart item not found.', 404);
    }

    const nextQuantity = Number(quantity);
    if (nextQuantity <= 0) {
      cart.items = cart.items.filter((cartItem) => cartItem.product._id.toString() !== productId);
    } else {
      if (item.product.stock < nextQuantity) {
        throw new AppError('Requested quantity is not available in stock.', 400);
      }
      item.quantity = nextQuantity;
      item.unitPrice = item.product.price;
    }

    await cart.save();
    return this.getCart(userId);
  }

  async removeItem(userId, productId) {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    cart.items = cart.items.filter((item) => item.product._id.toString() !== productId);
    await cart.save();
    return this.getCart(userId);
  }

  async applyCoupon(userId, code) {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    const subtotal = this.calculateSubtotal(cart);
    await this.couponService.validateCoupon(code, subtotal);

    cart.couponCode = code.toUpperCase();
    await cart.save();
    return this.getCart(userId);
  }

  async removeCoupon(userId) {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    cart.couponCode = null;
    await cart.save();
    return this.getCart(userId);
  }

  calculateSubtotal(cart) {
    return cart.items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  }

  async calculateTotals(cart) {
    const subtotal = this.calculateSubtotal(cart);
    const discount = await this.couponService.calculateDiscount(cart.couponCode, subtotal).catch(() => 0);
    const total = Math.max(subtotal - discount, 0);

    return { subtotal, discount, shipping: 0, tax: 0, total };
  }
}

module.exports = CartService;
