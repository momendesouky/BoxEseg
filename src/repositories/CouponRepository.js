const Coupon = require('../models/Coupon');
const BaseRepository = require('./BaseRepository');

class CouponRepository extends BaseRepository {
  constructor() {
    super(Coupon);
  }

  findByCode(code) {
    return this.model.findOne({ code: code.toUpperCase() });
  }

  list({ filter = {}, skip = 0, limit = 50, sort = '-createdAt' } = {}) {
    return this.model.find(filter).sort(sort).skip(skip).limit(limit);
  }

  incrementUsage(code, options = {}) {
    return this.model.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $inc: { usedCount: 1 } },
      options
    );
  }
}

module.exports = CouponRepository;
