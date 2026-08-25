require('dotenv').config();

const { connectDatabase } = require('../config/database');
const container = require('../config/container');
const logger = require('./logger');

const categories = [
  {
    name: 'MDF Boards',
    slug: 'mdf',
    description: 'Smooth and dense boards for cabinetry, routing, and painted finishes.',
    sortOrder: 1,
  },
  {
    name: 'Plywood',
    slug: 'plywood',
    description: 'Layered structural sheets for furniture, shelving, and workshop builds.',
    sortOrder: 2,
  },
  {
    name: 'PVC Panels',
    slug: 'pvc',
    description: 'Lightweight moisture-resistant panels for kitchens, bathrooms, and displays.',
    sortOrder: 3,
  },
  {
    name: 'HPL Sheets',
    slug: 'hpl',
    description: 'Durable decorative laminate sheets for counters and high-touch surfaces.',
    sortOrder: 4,
  },
];

const products = [
  {
    name: 'Premium MDF Board 18mm',
    slug: 'premium-mdf-board-18mm',
    sku: 'MDF-18-2440',
    material: 'MDF',
    categorySlug: 'mdf',
    price: 1450,
    stock: 18,
    featured: true,
    status: 'active',
    shortDescription: 'Smooth 18mm MDF sheet for cabinets, shelves, and CNC work.',
    description: 'A dependable MDF board with a uniform core and fine surface finish for painted interiors.',
    length: 2440,
    width: 1220,
    thickness: 18,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=1200',
        alt: 'MDF board sheets',
        isPrimary: true,
      },
    ],
  },
  {
    name: 'Birch Plywood Panel 15mm',
    slug: 'birch-plywood-panel-15mm',
    sku: 'PLY-BIRCH-15',
    material: 'PLYWOOD',
    categorySlug: 'plywood',
    price: 2100,
    stock: 10,
    featured: true,
    status: 'active',
    shortDescription: 'Balanced plywood sheet for furniture and shopfitting.',
    description: 'Stable birch plywood with clean edges and a strong laminated core.',
    length: 2440,
    width: 1220,
    thickness: 15,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&q=80&w=1200',
        alt: 'Plywood sheet',
        isPrimary: true,
      },
    ],
  },
  {
    name: 'Matte HPL Laminate Sheet',
    slug: 'matte-hpl-laminate-sheet',
    sku: 'HPL-MATTE-08',
    material: 'HPL',
    categorySlug: 'hpl',
    price: 980,
    stock: 42,
    featured: true,
    status: 'active',
    shortDescription: 'Matte laminate surface for counters, partitions, and panels.',
    description: 'High-pressure laminate with a clean matte finish and strong surface resistance.',
    length: 3050,
    width: 1300,
    thickness: 1,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=1200',
        alt: 'Matte laminate surface',
        isPrimary: true,
      },
    ],
  },
];

async function seed() {
  await connectDatabase();

  const savedCategories = {};

  for (const category of categories) {
    let existingCategory = await container.categoryRepository.findBySlug(category.slug);
    if (!existingCategory) {
      existingCategory = await container.categoryService.create(category);
      logger.info(`Created category ${category.name}`);
    }
    savedCategories[category.slug] = existingCategory;
  }

  for (const product of products) {
    const existingProduct = await container.productRepository.findBySlug(product.slug);
    if (existingProduct) continue;

    await container.productService.create({
      ...product,
      category: savedCategories[product.categorySlug].id,
      featured: true,
    });
    logger.info(`Created product ${product.name}`);
  }

  logger.info('Seed complete');
  process.exit(0);
}

seed().catch((error) => {
  logger.error('Seed failed', error);
  process.exit(1);
});
