const InventoryLog = require('../models/InventoryLog');
const BaseRepository = require('./BaseRepository');

class InventoryRepository extends BaseRepository {
  constructor() {
    super(InventoryLog);
  }

  list({ filter = {}, skip = 0, limit = 50, sort = '-createdAt' } = {}) {
    return this.model
      .find(filter)
      .populate('product', 'name sku stock')
      .populate('user', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }
}

module.exports = InventoryRepository;
