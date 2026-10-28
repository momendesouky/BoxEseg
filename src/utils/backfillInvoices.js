#!/usr/bin/env node
// Backfill / regenerate invoice PDFs for existing orders.
//
// Usage:
//   node src/utils/backfillInvoices.js              # only orders missing an invoice
//   node src/utils/backfillInvoices.js --all        # regenerate every order's invoice
//   node src/utils/backfillInvoices.js BX-2026...   # regenerate one order (by number)
//
// Deploy-friendly: pure JS (pdfkit), no browser binaries needed. Safe to run
// while the app is up; it only writes missing `invoice` subdocs and PDF files.

require('dotenv').config();

// Mirror server.js: on hosts (like this dev PC) whose resolver is dead,
// DNS_SERVERS pins an alternative resolver — leave unset in production.
if (process.env.DNS_SERVERS) {
  require('dns').setServers(
    process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  );
}

const { connectDatabase } = require('../config/database');
const InvoiceService = require('../services/InvoiceService');
const Order = require('../models/Order');
const logger = require('./logger');

async function main() {
  await connectDatabase();
  const invoiceService = new InvoiceService();

  const arg = process.argv[2] || '';
  const filter = arg === '--all'
    ? {}
    : arg && arg.startsWith('BX')
      ? { orderNumber: arg.toUpperCase() }
      : { 'invoice.path': { $exists: false, $ne: null } };

  const orders = await Order.find(filter).sort({ placedAt: -1 }).limit(500);
  logger.info(`Backfill: ${orders.length} order(s) to process`);

  let ok = 0;
  let failed = 0;
  for (const order of orders) {
    try {
      const invoice = await invoiceService.generateInvoice(order);
      await Order.updateOne({ _id: order._id }, { $set: { invoice } });
      ok += 1;
      logger.info(`  ${order.orderNumber}: OK → ${invoice.path}`);
    } catch (err) {
      failed += 1;
      logger.error(`  ${order.orderNumber}: FAILED — ${err.message}`);
    }
  }

  logger.info(`Backfill done: ${ok} generated, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  logger.error('Backfill crashed', err);
  process.exit(1);
});
