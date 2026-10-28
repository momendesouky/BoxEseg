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

  // ── Guest (session) cart ────────────────────────────────────────────────
  // Stored in req.session.guestCart: { items: [{productId, quantity, cutNotes}], couponCode }.
  // Display shape matches the DB cart's so existing views keep working.

  getGuestState(session) {
    if (!session.guestCart) {
      session.guestCart = { items: [], couponCode: null };
    }
    return session.guestCart;
  }

  async buildGuestCartView(session) {
    const guestState = this.getGuestState(session);
    const items = [];

    for (const entry of guestState.items) {
      const product = await this.productRepository.findActiveById(entry.productId);

      // Product deleted / deactivated / out of stock: drop it and persist the cleanup.
      if (!product) {
        continue;
      }

      const quantity = Math.min(entry.quantity, product.stock);
      if (quantity <= 0) {
        continue;
      }

      items.push({
        product,
        quantity,
        unitPrice: product.price,
        cutNotes: entry.cutNotes || '',
      });
    }

    const keptIds = new Set(items.map((item) => item.product.id));
    guestState.items = guestState.items.filter((entry) => keptIds.has(entry.productId));

    const cartLike = { items, couponCode: guestState.couponCode };
    const totals = await this.calculateTotals(cartLike);

    return { cart: cartLike, totals };
  }

  async addGuestItem(session, { productId, quantity = 1, cutNotes = '' }) {
    const product = await this.productRepository.findActiveById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    const guestState = this.getGuestState(session);
    const requested = Math.max(Number(quantity), 1);
    const existing = guestState.items.find((entry) => entry.productId === product.id);
    const nextQuantity = (existing ? existing.quantity : 0) + requested;

    if (product.stock < nextQuantity) {
      throw new AppError('Requested quantity is not available in stock.', 400);
    }

    if (existing) {
      existing.quantity = nextQuantity;
      existing.cutNotes = cutNotes || existing.cutNotes;
    } else {
      guestState.items.push({ productId: product.id, quantity: requested, cutNotes });
    }

    return this.buildGuestCartView(session);
  }

  async updateGuestItem(session, productId, quantity) {
    const guestState = this.getGuestState(session);
    const entry = guestState.items.find((item) => item.productId === productId);

    if (!entry) {
      throw new AppError('Cart item not found.', 404);
    }

    const next = Number(quantity);
    if (next <= 0) {
      guestState.items = guestState.items.filter((item) => item.productId !== productId);
      return this.buildGuestCartView(session);
    }

    const product = await this.productRepository.findActiveById(productId);
    if (!product || product.stock < next) {
      throw new AppError('Requested quantity is not available in stock.', 400);
    }

    entry.quantity = next;
    return this.buildGuestCartView(session);
  }

  async removeGuestItem(session, productId) {
    const guestState = this.getGuestState(session);
    guestState.items = guestState.items.filter((item) => item.productId !== productId);
    return this.buildGuestCartView(session);
  }

  async applyGuestCoupon(session, code) {
    const { cart } = await this.buildGuestCartView(session);
    await this.couponService.validateCoupon(code, this.calculateSubtotal(cart));

    const guestState = this.getGuestState(session);
    guestState.couponCode = code.toUpperCase();
    return this.buildGuestCartView(session);
  }

  async removeGuestCoupon(session) {
    const guestState = this.getGuestState(session);
    guestState.couponCode = null;
    return this.buildGuestCartView(session);
  }

  // On sign-in: merge the session cart into the user's DB cart, then clear it.
  async mergeGuestCart(session, userId) {
    const guestState = session.guestCart;

    if (!guestState || (!guestState.items.length && !guestState.couponCode)) {
      delete session.guestCart;
      return;
    }

    for (const entry of guestState.items) {
      try {
        // addItem is quantity-additive and resolves the fresh unit price.
        await this.addItem(userId, entry);
      } catch (err) {
        // Out of stock / disabled product during merge: skip that item.
        continue;
      }
    }

    delete session.guestCart;
  }
}

module.exports = CartService;
