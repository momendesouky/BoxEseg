const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer-core');
const logger = require('../utils/logger');

// Chromium executable used to print invoices. Resolution order:
// 1. INVOICE_CHROMIUM_PATH / CHROME_PATH env var (set this on the hosting box)
// 2. Well-known Linux paths (Hostinger VPS: apt install chromium-browser or google-chrome)
// 3. Well-known Windows paths (dev box: Edge ships with the OS)
function findChromium() {
  const override = process.env.INVOICE_CHROMIUM_PATH || process.env.CHROME_PATH;
  if (override) {
    if (fs.existsSync(override)) return override;
    logger.error(`INVOICE_CHROMIUM_PATH is set but does not exist: ${override}`);
  }

  const candidates = process.platform === 'win32'
    ? [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ]
    : [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium',
    ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const err = new Error(
    'No Chromium-based browser found for invoice generation. On Linux servers install one (e.g. "apt install -y chromium-browser" or set INVOICE_CHROMIUM_PATH).'
  );
  logger.error(err.message);
  throw err;
}

// Invoices are printed from an HTML template by headless Chromium:
// pixel-perfect design freedom and first-class Arabic shaping/bidi —
// things pdfkit cannot do.
class InvoiceService {
  async getBrowser() {
    if (this._browser) {
      try {
        if (this._browser.connected) return this._browser;
      } catch (_) {
        /* stale handle — relaunch below */
      }
    }

    this._browser = await puppeteer.launch({
      executablePath: findChromium(),
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    });
    logger.info('InvoiceService: Chromium launched');
    return this._browser;
  }

  async generateInvoice(order) {
    const invoicesDir = path.join(__dirname, '..', 'public', 'uploads', 'invoices');
    fs.mkdirSync(invoicesDir, { recursive: true });

    const fileName = `${order.orderNumber}.pdf`;
    const filePath = path.join(invoicesDir, fileName);

    const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
    const logoDataUrl = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';

    const templatePath = path.join(__dirname, '..', 'views', 'invoice', 'template.ejs');
    const html = ejs.render(fs.readFileSync(templatePath, 'utf8'), {
      order,
      logoDataUrl,
      dateLine: new Date(order.placedAt || order.createdAt || Date.now()).toLocaleDateString(
        'en-EG',
        { day: 'numeric', month: 'long', year: 'numeric' }
      ),
      methodLabel: {
        cod: 'Cash on delivery',
        paymob_card: 'Card (via Paymob)',
        paymob_wallet: 'Wallet (via Paymob)',
      }[order.paymentMethod] || order.paymentMethod,
      money: (value) => Number(value || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    }, { filename: templatePath });

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      logger.info(`Invoice generated for ${order.orderNumber}`);
    } finally {
      await page.close();
    }

    return {
      number: order.orderNumber,
      path: `/uploads/invoices/${fileName}`,
      generatedAt: new Date(),
    };
  }
}

module.exports = InvoiceService;
