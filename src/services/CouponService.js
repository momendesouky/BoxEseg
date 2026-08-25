const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

class CouponService {
  constructor({ couponRepository }) {
    this.couponRepository = couponRepository;
  }

  async list(query = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const [coupons, total] = await Promise.all([
      this.couponRepository.list({ filter, skip, limit }),
      this.couponRepository.count(filter),
    ]);

    return { coupons, pagination: buildPaginationMeta({ page, limit, total }) };
  }

  async create(payload) {
    return this.couponRepository.create(this.mapPayload(payload));
  }

  async update(id, payload) {
    const coupon = await this.couponRepository.updateById(id, this.mapPayload(payload));

    if (!coupon) {
      throw new AppError('Coupon not found.', 404);
    }

    return coupon;
  }

  async validateCoupon(code, subtotal) {
    if (!code) {
      return null;
    }

    const coupon = await this.couponRepository.findByCode(code);
    const now = new Date();

    if (!coupon || !coupon.isActive) {
      throw new AppError('Coupon is not valid.', 400);
    }

    if (coupon.startsAt && coupon.startsAt > now) {
      throw new AppError('Coupon is not active yet.', 400);
    }

    if (coupon.endsAt && coupon.endsAt < now) {
      throw new AppError('Coupon has expired.', 400);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit reached.', 400);
    }

    if (subtotal < coupon.minSubtotal) {
      throw new AppError(`Coupon requires a subtotal of at least ${coupon.minSubtotal} EGP.`, 400);
    }

    return coupon;
  }

  async calculateDiscount(code, subtotal) {
    const coupon = await this.validateCoupon(code, subtotal);

    if (!coupon) {
      return 0;
    }

    const rawDiscount = coupon.type === 'percent' ? subtotal * (coupon.value / 100) : coupon.value;
    return Math.min(rawDiscount, coupon.maxDiscount || rawDiscount, subtotal);
  }

  async markUsed(code, options = {}) {
    if (code) {
      await this.couponRepository.incrementUsage(code, options);
    }
  }

  mapPayload(payload) {
    return {
      code: payload.code,
      type: payload.type,
      value: Number(payload.value || 0),
      minSubtotal: Number(payload.minSubtotal || 0),
      maxDiscount: payload.maxDiscount ? Number(payload.maxDiscount) : undefined,
      usageLimit: payload.usageLimit ? Number(payload.usageLimit) : undefined,
      startsAt: payload.startsAt || undefined,
      endsAt: payload.endsAt || undefined,
      isActive: payload.isActive !== 'false',
    };
  }
}

module.exports = CouponService;
