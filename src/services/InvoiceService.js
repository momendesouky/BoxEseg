const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const { toVisual } = require('../utils/rtlText');

// Pure-JavaScript invoice renderer — no browser binaries required, so it runs
// on any hosting (shared Node hosting, cPanel, VPS) including Hostinger where
// Chromium cannot be installed.
//
// Arabic handling: pdfkit draws codepoints left to right without shaping or
// bidi, so every string passes through src/utils/rtlText.js, which converts
// logical text into presentation forms (via arabic-persian-reshaper) and
// reorders mixed-direction runs. The Amiri fonts shipped in src/assets/fonts
// embed all required Arabic glyphs including presentation forms — and their
// Latin subset, so one font family covers both.

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 46;
const CONTENT_W = PAGE.width - MARGIN * 2;

const COLORS = {
  card: '#FFFDF8',
  latte: '#FAF6EF',
  espresso: '#2B2018',
  mocha: '#6A5446',
  caramel: '#C1784F',
  caramelDeep: '#A25E3C',
  line: '#D9CFC3',
  lineStrong: '#9B8A76',
  paidBg: '#E7F0E9',
  paidFg: '#2F7D50',
  pendingBg: '#F8ECD8',
  pendingFg: '#A1721D',
  failedBg: '#F5E7E4',
  failedFg: '#B04035',
};

const STATUS_COLORS = {
  paid: ['paidBg', 'paidFg'],
  pending: ['pendingBg', 'pendingFg'],
  failed: ['failedBg', 'failedFg'],
};

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const METHOD_LABEL = {
  cod: 'Cash on delivery',
  paymob_card: 'Card (via Paymob)',
  paymob_wallet: 'Wallet (via Paymob)',
};

class InvoiceService {
  constructor() {
    this.fontsRegistered = false;
  }

  registerFonts(doc) {
    if (this.fontsRegistered) return;
    doc.registerFont('Amiri', path.join(FONT_DIR, 'Amiri-Regular.ttf'));
    doc.registerFont('Amiri-Bold', path.join(FONT_DIR, 'Amiri-Bold.ttf'));
    this.fontsRegistered = true;
  }

  // Draw one visual line, right-aligned (RTL) or left-aligned (LTR).
  line(doc, text, x, y, opts = {}) {
    const { width = CONTENT_W, size = 10, bold = false, color = COLORS.espresso, rtl, align, letterSpacing } = opts;
    const visual = toVisual(text);
    const isRtl = rtl !== undefined ? rtl : visual.rtl;
    doc
      .font(bold ? 'Amiri-Bold' : 'Amiri')
      .fontSize(size)
      .fillColor(color)
      .text(visual.text, x, y, {
        width,
        align: align || (isRtl ? 'right' : 'left'),
        lineBreak: false,
        ...(letterSpacing !== undefined ? { characterSpacing: letterSpacing } : {}),
      });
  }

  smallCaps(doc, text, x, y, { width, size = 9, color = COLORS.mocha, bold = true, align = 'left' }) {
    doc
      .font(bold ? 'Amiri-Bold' : 'Amiri')
      .fontSize(size)
      .fillColor(color)
      .text(text.toUpperCase(), x, y, { width, align, lineBreak: false, characterSpacing: 1.1 });
  }

  async generateInvoice(order) {
    const invoicesDir = path.join(__dirname, '..', 'public', 'uploads', 'invoices');
    fs.mkdirSync(invoicesDir, { recursive: true });

    const fileName = `${order.orderNumber}.pdf`;
    const filePath = path.join(invoicesDir, fileName);

    await this.render(order, filePath);
    logger.info(`Invoice generated for ${order.orderNumber}`);

    return {
      number: order.orderNumber,
      path: `/uploads/invoices/${fileName}`,
      generatedAt: new Date(),
    };
  }

  render(order, filePath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Invoice ${order.orderNumber}` } });
      const stream = fs.createWriteStream(filePath);
      const cleanup = (err) => {
        try { stream.close(); } catch (_) { /* noop */ }
        fs.rm(filePath, { force: true }, () => {});
        if (err) reject(err);
      };
      stream.on('finish', resolve);
      stream.on('error', (err) => cleanup(err));
      doc.on('error', (err) => cleanup(err));

      try {
        this.registerFonts(doc);
        this.draw(order, doc);
        doc.pipe(stream);
        doc.end();
      } catch (err) {
        cleanup(err);
      }
    });
  }

  draw(order, doc) {
    this.background(doc);
    this.header(doc, order);
    this.metaCards(doc, order);
    this.parties(doc, order);
    const itemsEnd = this.itemsTable(doc, order);
    this.totals(doc, order, itemsEnd);
    this.footer(doc, order);
  }

  background(doc) {
    doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.card);
  }

  header(doc, order) {
    const y = 42;
    const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
    let x = MARGIN;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, MARGIN, y - 6, { height: 40 });
        x += 46;
      } catch (err) {
        logger.warn(`Invoice: logo not drawn (${err.message})`);
      }
    }

    doc.font('Amiri-Bold').fontSize(24).fillColor(COLORS.espresso);
    doc.text('Box', x, y, { lineBreak: false, continued: true }).fillColor(COLORS.caramel).text('Eseg');
    this.smallCaps(doc, 'Stationery for the analog mind', x, y + 30, { width: 220, size: 8.5 });

    // Right column: INVOICE / number / status chip
    this.line(doc, 'Invoice', MARGIN + CONTENT_W - 200, y - 2, { width: 200, size: 22, bold: true, color: COLORS.caramelDeep, align: 'right', rtl: false });
    const numberVisual = toVisual(order.orderNumber);
    doc.font('Amiri-Bold').fontSize(11).fillColor(COLORS.espresso)
      .text(numberVisual.rtl ? numberVisual.text : order.orderNumber, MARGIN + CONTENT_W - 200, y + 26, { width: 200, align: 'right', lineBreak: false });

    const payStatus = (order.payment && order.payment.status) || 'pending';
    const [bgKey, fgKey] = STATUS_COLORS[payStatus] || STATUS_COLORS.pending;
    const chipW = 92;
    const chipY = y + 46;
    const chipX = MARGIN + CONTENT_W - chipW;
    doc.roundedRect(chipX, chipY, chipW, 20, 10).fill(COLORS[bgKey]);
    doc.roundedRect(chipX + 7, chipY + 8, 6, 6, 3).fill(COLORS[fgKey]);
    doc.font('Amiri-Bold').fontSize(8.5).fillColor(COLORS[fgKey])
      .text(payStatus.toUpperCase(), chipX + 16, chipY + 6.5, { width: chipW - 22, align: 'left', lineBreak: false, characterSpacing: 0.8 });

    // Header rule
    doc.rect(MARGIN, y + 84, CONTENT_W, 2).fill(COLORS.espresso);
    return y + 84;
  }

  metaCards(doc, order) {
    const top = 150;
    const gap = 10;
    const count = 4;
    const cardW = (CONTENT_W - gap * (count - 1)) / count;
    const cardH = 46;
    const dateLine = new Date(order.placedAt || order.createdAt || Date.now()).toLocaleDateString(
      'en-EG',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
    const tx =
      (order.payment && order.payment.transactionId) ||
      (order.payment && order.payment.paymobTransactionId) ||
      '—';
    const cards = [
      ['Invoice date', dateLine],
      ['Payment method', METHOD_LABEL[order.paymentMethod] || order.paymentMethod],
      ['Transaction', String(tx).slice(0, 24)],
      ['Order status', String(order.status)],
    ];

    cards.forEach(([label, value], i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.roundedRect(x, top, cardW, cardH, 8).fillAndStroke(COLORS.latte, COLORS.line);
      this.smallCaps(doc, label, x + 10, top + 9, { width: cardW - 20, size: 7.5 });
      const { text, rtl } = toVisual(value);
      doc.font('Amiri-Bold').fontSize(9.5).fillColor(COLORS.espresso)
        .text(text, x + 10, top + 24, { width: cardW - 20, align: rtl ? 'right' : 'left', lineBreak: true, height: 12 });
    });
    return top + cardH;
  }

  parties(doc, order) {
    const top = 214;
    const colW = (CONTENT_W - 30) / 2;
    const a = order.shippingAddress || {};

    // Billed to
    this.smallCaps(doc, 'Billed to', MARGIN, top, { width: colW });
    doc.rect(MARGIN, top + 14, colW, 1).fill(COLORS.lineStrong);
    let by = top + 24;
    const contactName = a.fullName || 'Customer';
    this.line(doc, contactName, MARGIN, by, { width: colW, size: 11.5, bold: true });
    by += 16;
    if (a.phone) {
      this.line(doc, String(a.phone), MARGIN, by, { width: colW, size: 9.5, rtl: false });
      by += 13;
    }
    const guest = order.guest;
    if (guest && (guest.email || guest.phone)) {
      this.line(doc, `${guest.email || guest.phone} (guest)`, MARGIN, by, { width: colW, size: 9, color: COLORS.mocha, rtl: false });
      by += 12;
    }

    // Ship to
    const sx = MARGIN + colW + 30;
    this.smallCaps(doc, 'Ship to', sx, top, { width: colW });
    doc.rect(sx, top + 14, colW, 1).fill(COLORS.lineStrong);
    let sy = top + 24;
    const street = [a.building, a.street].filter(Boolean).join(', ');
    const area = [a.area, a.city].filter(Boolean).join(', ');
    this.line(doc, [street, area].filter(Boolean).join(' — '), sx, sy, { width: colW, size: 9.5 });
    sy += 15;
    if (a.notes) {
      const wrapped = doc.font('Amiri').fontSize(8.5).fillColor(COLORS.caramelDeep);
      const { text, rtl } = toVisual(`Note: ${a.notes}`);
      wrapped.text(text, sx, sy, { width: colW, align: rtl ? 'right' : 'left', lineBreak: true, height: 30 });
    }
    return top + 60;
  }

  itemsTable(doc, order) {
    let top = 288;
    const colItem = CONTENT_W - 210;
    const colQty = 40;
    const colUnit = 85;
    const colTotal = 85;
    const xQty = MARGIN + colItem;
    const xUnit = xQty + colQty;
    const xTotal = xUnit + colUnit;
    const nameW = colItem - 12;

    const head = () => {
      this.smallCaps(doc, 'Item', MARGIN, top + 8, { width: nameW });
      this.smallCaps(doc, 'Qty', xQty, top + 8, { width: colQty - 8, align: 'right' });
      this.smallCaps(doc, 'Unit price', xUnit, top + 8, { width: colUnit - 8, align: 'right' });
      this.smallCaps(doc, 'Total', xTotal, top + 8, { width: colTotal, align: 'right' });
      doc.rect(MARGIN, top + 24, CONTENT_W, 1.5).fill(COLORS.lineStrong);
    };
    head();
    top += 36;

    const money = (v) =>
      Number(v || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    for (const item of order.items || []) {
      // Page break: start a fresh page and repeat the table header.
      if (top > PAGE.height - 170) {
        doc.addPage();
        doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.card);
        top = 70;
        head();
        top += 36;
      }
      const nameVisual = toVisual(item.name || 'Item');

      // Name (wraps naturally; pdfkit advances doc.y afterwards)
      doc
        .font('Amiri-Bold')
        .fontSize(10)
        .fillColor(COLORS.espresso)
        .text(nameVisual.text, MARGIN, top, {
          width: nameW,
          align: nameVisual.rtl ? 'right' : 'left',
          lineBreak: true,
          paragraphGap: 1,
        });

      const subY = doc.y;
      if (item.sku || item.material) {
        const sub = `SKU ${item.sku || ''}${item.sku && item.material ? ' · ' : ''}${item.material || ''}`;
        doc.font('Amiri').fontSize(8).fillColor(COLORS.mocha)
          .text(sub, MARGIN, subY, { width: nameW, align: 'left', lineBreak: true });
      }
      if (item.cutNotes) {
        const cut = toVisual(`Cut: ${item.cutNotes}`);
        doc.font('Amiri').fontSize(8).fillColor(COLORS.caramelDeep)
          .text(cut.text, MARGIN, doc.y, { width: nameW, align: cut.rtl ? 'right' : 'left', lineBreak: true });
      }
      const rowH = doc.y - top;
      const h = Math.max(rowH, 16);

      // Numeric columns vertically centered on the row
      const numY = top + Math.max(2, (h - 12) / 2);
      doc.font('Amiri-Bold').fontSize(9.5).fillColor(COLORS.espresso)
        .text(String(item.quantity || 0), xQty, numY, { width: colQty - 8, align: 'right', lineBreak: false });
      doc.font('Amiri').fontSize(9.5).fillColor(COLORS.espresso)
        .text(money(item.unitPrice), xUnit, numY, { width: colUnit - 8, align: 'right', lineBreak: false });
      doc.font('Amiri-Bold').fontSize(9.5).fillColor(COLORS.espresso)
        .text(money(item.lineTotal), xTotal, numY, { width: colTotal, align: 'right', lineBreak: false });

      top += h + 6;
      doc.rect(MARGIN, top, CONTENT_W, 0.6).dash(2, 3).stroke(COLORS.line);
      doc.undash();
      top += 6;
    }

    return top;
  }

  totals(doc, order, itemsEnd) {
    const rows = [];
    if (order.subtotal != null) rows.push(['Subtotal', moneySafe(order.subtotal), false]);
    if (order.discount > 0) {
      rows.push([order.couponCode ? `Discount (${order.couponCode})` : 'Discount', moneySafe(order.discount), true]);
    }
    if (order.shipping > 0) rows.push(['Shipping', moneySafe(order.shipping), false]);
    if (order.tax > 0) rows.push(['Tax', moneySafe(order.tax), false]);

    const boxW = 240;
    const rowH = 20;
    const grandH = 34;
    let top = Math.max(itemsEnd || 300, 300) + 16;
    const boxH = rows.length * rowH + grandH + 6;
    top = Math.min(top, PAGE.height - 110 - boxH);
    const x = MARGIN + CONTENT_W - boxW;

    let y = top;
    for (const [label, value, isDiscount] of rows) {
      const color = isDiscount ? COLORS.paidFg : COLORS.mocha;
      this.line(doc, label, x, y, { width: boxW / 2 - 10, size: 9.5, color, rtl: false });
      doc.font(isDiscount ? 'Amiri-Bold' : 'Amiri').fontSize(9.5).fillColor(color)
        .text(`${isDiscount ? '-' : ''}${value}`, x, y, { width: boxW - 10, align: 'right', lineBreak: false });
      y += rowH;
    }

    doc.roundedRect(x, y + 6, boxW, grandH, 8).fill(COLORS.espresso);
    doc.font('Amiri-Bold').fontSize(13).fillColor(COLORS.latte)
      .text('Total', x + 14, y + 15.5, { width: boxW / 2, lineBreak: false });
    doc.font('Amiri-Bold').fontSize(13).fillColor(COLORS.latte)
      .text(`${moneySafe(order.total)} EGP`, x, y + 15.5, { width: boxW - 14, align: 'right', lineBreak: false });

    return y + grandH;
  }

  footer(doc, order) {
    const y = PAGE.height - 96;
    doc.rect(MARGIN, y, CONTENT_W, 0.8).fill(COLORS.lineStrong);

    this.line(doc, 'Thank you for shopping with BoxEseg.', MARGIN, y + 16, {
      width: CONTENT_W / 2 - 20, size: 11.5, bold: true, rtl: false,
    });

    const rx = MARGIN + CONTENT_W / 2 + 10;
    const rw = CONTENT_W / 2 - 10;
    doc.font('Amiri').fontSize(9).fillColor(COLORS.mocha)
      .text('Questions about this invoice?', rx, y + 14, { width: rw, align: 'right', lineBreak: false });
    doc.font('Amiri-Bold').fontSize(9).fillColor(COLORS.espresso)
      .text('Track it anytime at boxeseg.com/orders/guest', rx, y + 28, { width: rw, align: 'right', lineBreak: false });

    this.smallCaps(doc, 'BoxEseg · Curating the finest analog tools', MARGIN, PAGE.height - 36, {
      width: CONTENT_W, size: 7.5, color: '#B7A995', bold: true, align: 'center',
    });
  }
}

function moneySafe(v) {
  return Number(v || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = InvoiceService;
