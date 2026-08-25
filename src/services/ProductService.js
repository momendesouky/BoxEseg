const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { makeSlug } = require('../utils/slug');

const materialLabels = {
  MDF: 'MDF',
  PLYWOOD: 'Plywood',
  PVC: 'PVC',
  HPL: 'HPL',
  WOOD_PANEL: 'Wood Panel',
  OTHER: 'Other',
};

class ProductService {
  constructor({ productRepository, categoryRepository }) {
    this.productRepository = productRepository;
    this.categoryRepository = categoryRepository;
  }

  async list(query = {}, options = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = await this.buildFilter(query, options.admin);
    const sort = this.buildSort(query.sort);

    const [products, total] = await Promise.all([
      this.productRepository.list({ filter, skip, limit, sort }),
      this.productRepository.count(filter),
    ]);

    return {
      products,
      pagination: buildPaginationMeta({ page, limit, total }),
      filters: query,
      materialLabels,
    };
  }

  async featured(limit = 6) {
    const products = await this.productRepository.findFeatured(limit);
    return products.length ? products : this.fallbackProducts();
  }

  async findBySlug(slug) {
    const product = await this.productRepository.findBySlug(slug);

    if (!product || product.status !== 'active') {
      throw new AppError('Product not found.', 404);
    }

    return product;
  }

  async findAdminProduct(id) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    return product;
  }

  async create(payload) {
    await this.ensureCategory(payload.category);

    const slug = makeSlug(payload.slug || payload.name);
    const existingProduct = await this.productRepository.findBySlug(slug);

    if (existingProduct) {
      throw new AppError('A product with this slug already exists.', 409);
    }

    return this.productRepository.create(this.mapPayload(payload, slug));
  }

  async update(id, payload) {
    if (payload.category) {
      await this.ensureCategory(payload.category);
    }

    const data = this.mapPayload(payload, payload.slug || payload.name ? makeSlug(payload.slug || payload.name) : null);
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

    const product = await this.productRepository.updateById(id, data);

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    return product;
  }

  async remove(id) {
    const product = await this.productRepository.updateById(id, { status: 'archived' });

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    return product;
  }

  async ensureCategory(categoryId) {
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new AppError('Category is required.', 400);
    }

    return category;
  }

  async buildFilter(query, admin = false) {
    const filter = admin ? {} : { status: 'active' };

    if (query.q) {
      const search = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: search }, { sku: search }, { description: search }, { tags: search }];
    }

    if (query.category) {
      const category = await this.categoryRepository.findBySlug(query.category);
      if (category) {
        filter.category = category.id;
      }
    }

    if (query.material && materialLabels[query.material]) {
      filter.material = query.material;
    }

    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    if (admin && query.status) {
      filter.status = query.status;
    }

    return filter;
  }

  buildSort(sort = 'latest') {
    const sorts = {
      latest: '-createdAt',
      price_asc: 'price',
      price_desc: '-price',
      name: 'name',
      rating: '-averageRating',
    };

    return sorts[sort] || sorts.latest;
  }

  mapPayload(payload, slug) {
    return {
      name: payload.name,
      slug: slug || undefined,
      sku: payload.sku,
      category: payload.category,
      material: payload.material,
      description: payload.description,
      shortDescription: payload.shortDescription,
      dimensions: {
        length: Number(payload.length || 0),
        width: Number(payload.width || 0),
        thickness: Number(payload.thickness || 0),
        unit: payload.unit || 'mm',
      },
      images: payload.images,
      price: Number(payload.price || 0),
      compareAtPrice: payload.compareAtPrice ? Number(payload.compareAtPrice) : undefined,
      cost: payload.cost ? Number(payload.cost) : undefined,
      stock: Number(payload.stock || 0),
      lowStockThreshold: Number(payload.lowStockThreshold || 5),
      status: payload.status || 'draft',
      featured: payload.featured === 'on' || payload.featured === true,
      tags: typeof payload.tags === 'string' ? payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      attributes: {
        finish: payload.finish,
        grade: payload.grade,
        color: payload.color,
        usage: payload.usage,
      },
      weightKg: payload.weightKg ? Number(payload.weightKg) : undefined,
    };
  }

  fallbackProducts() {
    return [
      {
        name: 'Premium MDF Board',
        slug: 'premium-mdf-board',
        material: 'MDF',
        price: 1450,
        stock: 18,
        shortDescription: 'Dense, smooth 18mm sheet for cabinetry and routing.',
        images: [{ url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=1200', alt: 'MDF board' }],
        category: { name: 'MDF Boards', slug: 'mdf' },
        averageRating: 4.8,
      },
      {
        name: 'Birch Plywood Panel',
        slug: 'birch-plywood-panel',
        material: 'PLYWOOD',
        price: 2100,
        stock: 10,
        shortDescription: 'Balanced plywood for furniture, shelving, and shopfitting.',
        images: [{ url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&q=80&w=1200', alt: 'Plywood panel' }],
        category: { name: 'Plywood', slug: 'plywood' },
        averageRating: 4.6,
      },
      {
        name: 'Matte HPL Laminate',
        slug: 'matte-hpl-laminate',
        material: 'HPL',
        price: 980,
        stock: 42,
        shortDescription: 'Hard-wearing surface sheet for counters and interior panels.',
        images: [{ url: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=1200', alt: 'Laminate surface' }],
        category: { name: 'HPL Sheets', slug: 'hpl' },
        averageRating: 4.9,
      },
    ];
  }
}

module.exports = ProductService;
