class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  create(data, options = {}) {
    if (Object.keys(options).length) {
      return this.model.create([data], options).then((docs) => docs[0]);
    }

    return this.model.create(data);
  }

  findById(id, projection = null, options = {}) {
    return this.model.findById(id, projection, options);
  }

  updateById(id, data, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, data, options);
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  count(filter = {}) {
    return this.model.countDocuments(filter);
  }
}

module.exports = BaseRepository;
