const Category = require('../models/Category');
const BaseRepository = require('./BaseRepository');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(Category);
  }

  findBySlug(slug) {
    return this.model.findOne({ slug });
  }

  list({ filter = {}, skip = 0, limit = 100, sort = 'sortOrder name' } = {}) {
    return this.model.find(filter).sort(sort).skip(skip).limit(limit).populate('parent', 'name slug');
  }
}

module.exports = CategoryRepository;
