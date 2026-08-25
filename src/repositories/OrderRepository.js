const Order = require('../models/Order');
const BaseRepository = require('./BaseRepository');

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  findByOrderNumber(orderNumber) {
    return this.model.findOne({ orderNumber }).populate('user', 'firstName lastName email phone');
  }

  updateByOrderNumber(orderNumber, data) {
    return this.model.findOneAndUpdate({ orderNumber }, data, { new: true, runValidators: true });
  }

  findForUser(orderId, userId) {
    return this.model.findOne({ _id: orderId, user: userId });
  }

  listForUser(userId, { skip = 0, limit = 20 } = {}) {
    return this.model.find({ user: userId }).sort('-createdAt').skip(skip).limit(limit);
  }

  list({ filter = {}, skip = 0, limit = 20, sort = '-createdAt' } = {}) {
    return this.model
      .find(filter)
      .populate('user', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  totalRevenue() {
    return this.model.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
  }
}

module.exports = OrderRepository;
