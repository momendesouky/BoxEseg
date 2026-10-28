const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const logger = require('../utils/logger');

class OrderService {
  constructor({
    cartRepository,
    productRepository,
    orderRepository,
    inventoryRepository,
    couponService,
    emailService,
    invoiceService,
    paymentService,
    smsService,
  }) {
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
    this.orderRepository = orderRepository;
    this.inventoryRepository = inventoryRepository;
    this.couponService = couponService;
    this.emailService = emailService;
    this.invoiceService = invoiceService;
    this.paymentService = paymentService;
    this.smsService = smsService;
  }

  async listForUser(userId, query = {}) {
    const { page, limit, skip } = getPagination(query);
    const [orders, total] = await Promise.all([
      this.orderRepository.listForUser(userId, { skip, limit }),
      this.orderRepository.count({ user: userId }),
    ]);

    return { orders, pagination: buildPaginationMeta({ page, limit, total }) };
  }

  async listForAdmin(query = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter['payment.status'] = query.paymentStatus;

    const [orders, total] = await Promise.all([
      this.orderRepository.list({ filter, skip, limit }),
      this.orderRepository.count(filter),
    ]);

    return { orders, pagination: buildPaginationMeta({ page, limit, total }) };
  }

  async findForUser(orderId, userId) {
    const order = await this.orderRepository.findForUser(orderId, userId);

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    return order;
  }

  async findById(orderId) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    return order;
  }

  async checkout(user, payload) {
    if (payload.paymentMethod?.startsWith('paymob')) {
      this.paymentService.ensurePaymobConfigured(payload.paymentMethod);
    }

    const cart = await this.cartRepository.findByUser(user.id);
    if (!cart || cart.items.length === 0) {
      throw new AppError('Your cart is empty.', 400);
    }

    const totals = await this.calculateOrderTotals(cart);
    const shippingAddress = this.mapAddress(payload);
    const orderNumber = this.createOrderNumber();
    const isPaymob = payload.paymentMethod?.startsWith('paymob');
    const isCash = payload.paymentMethod?.startsWith('cash');
    
    logger.info(`Checkout: order=${orderNumber} method=${payload.paymentMethod} items=${cart.items.length} total=${totals.total}`);

    const session = await mongoose.startSession();
    let order;

    try {
      await session.withTransaction(async () => {
        const orderItems = [];

        for (const item of cart.items) {
          const product = item.product;
          const updatedProduct = await this.productRepository.decrementStock(product.id, item.quantity, { session });

          if (!updatedProduct) {
            throw new AppError(`${product.name} is no longer available in the requested quantity.`, 400);
          }

          orderItems.push({
            product: product.id,
            name: product.name,
            sku: product.sku,
            image: product.images?.[0]?.url,
            material: product.material,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
            cutNotes: item.cutNotes,
          });

          await this.inventoryRepository.create(
            {
              product: product.id,
              user: user.id,
              type: 'sale',
              quantityChange: -item.quantity,
              stockAfter: updatedProduct.stock,
              note: `Order ${orderNumber}`,
            },
            { session }
          );
        }

        order = await this.orderRepository.create(
          {
            orderNumber,
            user: user.id,
            items: orderItems,
            shippingAddress,
            subtotal: totals.subtotal,
            discount: totals.discount,
            shipping: totals.shipping,
            tax: totals.tax,
            total: totals.total,
            couponCode: cart.couponCode,
            paymentMethod: payload.paymentMethod,
            payment: {
              status: 'pending',
              provider: isPaymob ?'paymob':'cash'
            },
            status: 'pending',
          },
          { session }
        );

        await this.couponService.markUsed(cart.couponCode, { session });

        if (!isPaymob) {
          await this.cartRepository.clear(user.id, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    logger.info(`Checkout: order ${orderNumber} created in DB`);

    if (payload.paymentMethod === 'paymob_card') {
      try {
        const iframeUrl = await this.paymentService.createPaymobCardPayment({ ...order.toObject(), user });
        order = await this.orderRepository.updateById(order.id, { payment: { ...order.payment, iframeUrl } });
        logger.info(`Checkout: paymob_card iframe URL saved for order ${orderNumber}`);
      } catch (err) {
        logger.error(`Checkout: paymob_card failed for order ${orderNumber}: ${err.message}`);
        throw new AppError('Payment gateway error: ' + (err.message || 'Unable to connect to Paymob. Please try again.'), 502);
      }
    }

    if (payload.paymentMethod === 'paymob_wallet') {
      try {
        const result = await this.paymentService.createPaymobWalletPayment({ ...order.toObject(), user });
        order = await this.orderRepository.updateById(order.id, { payment: { ...order.payment, walletToken: result.token } });
        logger.info(`Checkout: paymob_wallet token saved for order ${orderNumber}`);
      } catch (err) {
        logger.error(`Checkout: paymob_wallet failed for order ${orderNumber}: ${err.message}`);
        throw new AppError('Payment gateway error: ' + (err.message || 'Unable to connect to Paymob. Please try again.'), 502);
      }
    }

    this.invoiceService.generateInvoice(order).then(async (invoice) => {
      await this.orderRepository.updateById(order.id, { invoice });
      logger.info(`Checkout: invoice generated for order ${orderNumber}`);
    }).catch((err) => {
      logger.error(`Checkout: invoice generation failed for order ${orderNumber}: ${err.message}`);
    });

    this.emailService.sendOrderConfirmation(user, order).catch((err) => {
      logger.error(`Checkout: email failed for order ${orderNumber}: ${err.message}`);
    });

    if (isPaymob) {
      await this.cartRepository.clear(user.id);
    }
    logger.info(`Checkout: cart cleared for user ${user.id}, order ${orderNumber} ready for redirect`);

    return order;
  }

  /**
   * Guest checkout: same pipeline as `checkout` but identity comes from a
   * verified OTP contact instead of a signed-in user.
   * contact: { type: 'email'|'phone', value, verifiedAt } — already OTP-verified.
   * payload: { items:[{productId, quantity, cutNotes}], couponCode, ...address, paymentMethod }
   */
  async checkoutGuest(contact, payload, options = {}) {
    if (payload.paymentMethod?.startsWith('paymob')) {
      this.paymentService.ensurePaymobConfigured(payload.paymentMethod);
    }

    if (!payload.items || payload.items.length === 0) {
      throw new AppError('Your cart is empty.', 400);
    }

    // Fresh product data: prices/stock are re-validated at order time.
    const cartItems = [];
    for (const entry of payload.items) {
      const product = await this.productRepository.findActiveById(entry.productId);
      if (!product) {
        throw new AppError('One of the products is no longer available. Please review your cart.', 400);
      }
      const quantity = Number(entry.quantity);
      if (product.stock < quantity) {
        throw new AppError(`${product.name} is no longer available in the requested quantity.`, 400);
      }
      cartItems.push({ product, quantity, unitPrice: product.price, cutNotes: entry.cutNotes || '' });
    }

    const cartLike = { items: cartItems, couponCode: payload.couponCode || null };
    const totals = await this.calculateOrderTotals(cartLike);
    const shippingAddress = this.mapAddress(payload);
    const orderNumber = this.createOrderNumber();
    const isPaymob = payload.paymentMethod?.startsWith('paymob');

    logger.info(`Guest checkout: order=${orderNumber} method=${payload.paymentMethod} items=${cartItems.length} total=${totals.total}`);

    const guest = {
      name: payload.fullName,
      email: contact.type === 'email' ? contact.value : undefined,
      phone: contact.type === 'phone' ? contact.value : undefined,
    };

    const session = await mongoose.startSession();
    let order;

    try {
      await session.withTransaction(async () => {
        const orderItems = [];

        for (const item of cartItems) {
          const product = item.product;
          const updatedProduct = await this.productRepository.decrementStock(product.id, item.quantity, { session });

          if (!updatedProduct) {
            throw new AppError(`${product.name} is no longer available in the requested quantity.`, 400);
          }

          orderItems.push({
            product: product.id,
            name: product.name,
            sku: product.sku,
            image: product.images?.[0]?.url,
            material: product.material,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
            cutNotes: item.cutNotes,
          });

          await this.inventoryRepository.create(
            {
              product: product.id,
              type: 'sale',
              quantityChange: -item.quantity,
              stockAfter: updatedProduct.stock,
              note: `Order ${orderNumber} (guest)`,
            },
            { session }
          );
        }

        order = await this.orderRepository.create(
          {
            orderNumber,
            guest,
            items: orderItems,
            shippingAddress,
            subtotal: totals.subtotal,
            discount: totals.discount,
            shipping: totals.shipping,
            tax: totals.tax,
            total: totals.total,
            couponCode: cartLike.couponCode,
            paymentMethod: payload.paymentMethod,
            payment: {
              status: 'pending',
              provider: isPaymob ? 'paymob' : 'cash',
            },
            status: 'pending',
          },
          { session }
        );

        await this.couponService.markUsed(cartLike.couponCode, { session });
      });
    } finally {
      await session.endSession();
    }

    logger.info(`Guest checkout: order ${orderNumber} created in DB`);

    if (payload.paymentMethod === 'paymob_card') {
      try {
        const iframeUrl = await this.paymentService.createPaymobCardPayment(order);
        order = await this.orderRepository.updateById(order.id, { payment: { ...order.payment, iframeUrl } });
        logger.info(`Guest checkout: paymob_card iframe URL saved for order ${orderNumber}`);
      } catch (err) {
        logger.error(`Guest checkout: paymob_card failed for order ${orderNumber}: ${err.message}`);
        throw new AppError('Payment gateway error: ' + (err.message || 'Unable to connect to Paymob. Please try again.'), 502);
      }
    }

    if (payload.paymentMethod === 'paymob_wallet') {
      try {
        const result = await this.paymentService.createPaymobWalletPayment(order);
        order = await this.orderRepository.updateById(order.id, { payment: { ...order.payment, walletToken: result.token } });
        logger.info(`Guest checkout: paymob_wallet token saved for order ${orderNumber}`);
      } catch (err) {
        logger.error(`Guest checkout: paymob_wallet failed for order ${orderNumber}: ${err.message}`);
        throw new AppError('Payment gateway error: ' + (err.message || 'Unable to connect to Paymob. Please try again.'), 502);
      }
    }

    this.invoiceService.generateInvoice(order).then(async (invoice) => {
      await this.orderRepository.updateById(order.id, { invoice });
      logger.info(`Guest checkout: invoice generated for order ${orderNumber}`);
    }).catch((err) => {
      logger.error(`Guest checkout: invoice generation failed for order ${orderNumber}: ${err.message}`);
    });

    // Guest confirmation goes to whichever contact was just verified.
    if (guest.email) {
      this.emailService.sendGuestOrderConfirmation({ name: guest.name, email: guest.email }, order).catch((err) => {
        logger.error(`Guest checkout: email failed for order ${orderNumber}: ${err.message}`);
      });
    } else if (guest.phone && this.smsService) {
      this.smsService
        .send({ to: guest.phone, message: `BoxEseg: order ${order.orderNumber} received. Total: ${order.total} EGP. Track: ${env.clientUrl}/orders/guest` })
        .catch((err) => logger.error(`Guest checkout: SMS failed for order ${orderNumber}: ${err.message}`));
    }

    // Extra free confirmation into the Telegram chat the guest linked during
    // verification (see TelegramService).
    if (options.telegramChatId && this.telegramService) {
      this.telegramService
        .send(options.telegramChatId, `BoxEseg: order ${order.orderNumber} received! Total: ${order.total} EGP. Track: ${env.clientUrl}/orders/guest`)
        .catch((err) => logger.error(`Guest checkout: Telegram confirmation failed for order ${orderNumber}: ${err.message}`));
    }

    return order;
  }

  async confirmPayment(orderNumber, transactionId) {
    const existing = await this.orderRepository.findByOrderNumber(orderNumber);

    if (!existing) {
      logger.error(`confirmPayment: order ${orderNumber} not found`);
      return null;
    }

    if (existing.payment?.status === 'paid') {
      logger.info(`confirmPayment: order ${orderNumber} already confirmed — skipping`);
      return existing;
    }

    const update = {
      status: 'confirmed',
      payment: {
        status: 'paid',
        provider: 'paymob',
        transactionId: transactionId || existing.payment?.transactionId || 'callback',
      },
    };

    const order = await this.orderRepository.updateByOrderNumber(orderNumber, update);
    logger.info(`confirmPayment: order ${orderNumber} confirmed, transactionId=${transactionId || 'n/a'}`);
    return order;
  }

  async updateStatus(orderId, payload) {
    const update = {};
    if (payload.status) update.status = payload.status;
    if (payload.paymentStatus) update['payment.status'] = payload.paymentStatus;

    const order = await this.orderRepository.updateById(orderId, update);

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    return order;
  }

  async handlePaymobWebhook(payload) {
    const data = payload.obj || payload;
    const merchantOrderId = data.order?.merchant_order_id || data.merchant_order_id;

    if (!merchantOrderId) {
      throw new AppError('Paymob webhook is missing merchant order id.', 400);
    }

    const paymentStatus = data.success === true || data.success === 'true' ? 'paid' : 'failed';
    const orderStatus = paymentStatus === 'paid' ? 'confirmed' : 'pending';

    logger.info(`Webhook: order=${merchantOrderId} success=${data.success} paymentStatus=${paymentStatus}`);

    const existing = await this.orderRepository.findByOrderNumber(merchantOrderId);

    if (!existing) {
      throw new AppError('Order not found for Paymob webhook.', 404);
    }

    if (existing.payment?.status === 'paid') {
      logger.info(`Webhook: order ${merchantOrderId} already paid — skipping update`);
      return existing;
    }

    const order = await this.orderRepository.updateByOrderNumber(merchantOrderId, {
      status: orderStatus,
      payment: {
        status: paymentStatus,
        provider: 'paymob',
        transactionId: data.id,
        raw: data,
      },
    });

    return order;
  }

  async calculateOrderTotals(cart) {
    const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = await this.couponService.calculateDiscount(cart.couponCode, subtotal).catch(() => 0);
    const shipping = 0;
    const tax = 0;
    const total = Math.max(subtotal - discount + tax, 0);

    return { subtotal, discount, shipping, tax, total };
  }

  mapAddress(payload) {
    return {
      fullName: payload.fullName,
      phone: payload.phone,
      city: payload.city,
      area: payload.area,
      street: payload.street,
      building: payload.building,
      notes: payload.notes,
    };
  }

  createOrderNumber() {
    return `BX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 8).toUpperCase()}`;
  }
}

module.exports = OrderService;
