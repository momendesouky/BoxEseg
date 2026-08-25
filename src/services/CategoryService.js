const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { makeSlug } = require('../utils/slug');

class CategoryService {
  constructor({ categoryRepository }) {
    this.categoryRepository = categoryRepository;
  }

  async listActive() {
    const categories = await this.categoryRepository.list({
      filter: { isActive: true },
      limit: 100,
      sort: 'sortOrder name',
    });

    return categories.length ? categories : this.fallbackCategories();
  }

  async listForAdmin(query) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'hidden') filter.isActive = false;

    const [categories, total] = await Promise.all([
      this.categoryRepository.list({ filter, skip, limit }),
      this.categoryRepository.count(filter),
    ]);

    return {
      categories,
      pagination: buildPaginationMeta({ page, limit, total }),
    };
  }

  async create(payload) {
    const slug = makeSlug(payload.slug || payload.name);
    const existingCategory = await this.categoryRepository.findBySlug(slug);

    if (existingCategory) {
      throw new AppError('A category with this slug already exists.', 409);
    }

    return this.categoryRepository.create({
      name: payload.name,
      slug,
      description: payload.description,
      parent: payload.parent || null,
      sortOrder: payload.sortOrder || 0,
      isActive: payload.isActive !== 'false',
      image: payload.image,
    });
  }

  async update(id, payload) {
    const data = {
      name: payload.name,
      description: payload.description,
      parent: payload.parent || null,
      sortOrder: payload.sortOrder || 0,
      isActive: payload.isActive !== 'false',
    };

    if (payload.slug || payload.name) {
      data.slug = makeSlug(payload.slug || payload.name);
    }

    if (payload.image) {
      data.image = payload.image;
    }

    const category = await this.categoryRepository.updateById(id, data);

    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    return category;
  }

  async findById(id) {
    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    return category;
  }

  fallbackCategories() {
    return [
      { name: 'MDF Boards', slug: 'mdf', description: 'Smooth, reliable boards for cabinetry and CNC work.' },
      { name: 'Plywood', slug: 'plywood', description: 'Layered sheets for durable furniture and fit-outs.' },
      { name: 'PVC Panels', slug: 'pvc', description: 'Moisture-resistant surfaces for kitchens and displays.' },
      { name: 'HPL Sheets', slug: 'hpl', description: 'Decorative laminates with high surface resistance.' },
    ];
  }
}

module.exports = CategoryService;
