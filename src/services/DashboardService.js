class DashboardService {
  constructor({
    userRepository,
    productRepository,
    categoryRepository,
    orderRepository,
    inventoryRepository,
    couponRepository,
  }) {
    this.userRepository = userRepository;
    this.productRepository = productRepository;
    this.categoryRepository = categoryRepository;
    this.orderRepository = orderRepository;
    this.inventoryRepository = inventoryRepository;
    this.couponRepository = couponRepository;
  }

  async summary() {
    const [users, products, categories, orders, lowStockProducts, revenueResult] = await Promise.all([
      this.userRepository.count({ isActive: true }),
      this.productRepository.count({ status: { $ne: 'archived' } }),
      this.categoryRepository.count({ isActive: true }),
      this.orderRepository.count({}),
      this.productRepository.list({
        filter: { status: 'active', $expr: { $lte: ['$stock', '$lowStockThreshold'] } },
        limit: 6,
      }),
      this.orderRepository.totalRevenue(),
    ]);

    return {
      users,
      products,
      categories,
      orders,
      lowStockProducts,
      revenue: revenueResult[0]?.total || 0,
    };
  }

  async inventory(query = {}) {
    const logs = await this.inventoryRepository.list({ limit: 50 });
    const lowStockProducts = await this.productRepository.list({
      filter: { status: 'active', $expr: { $lte: ['$stock', '$lowStockThreshold'] } },
      limit: 50,
    });

    return { logs, lowStockProducts };
  }

  async reports() {
    return this.summary();
  }
}

module.exports = DashboardService;
