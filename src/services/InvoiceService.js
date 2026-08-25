const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

class InvoiceService {
  async generateInvoice(order) {
    const invoicesDir = path.join(__dirname, '..', 'public', 'uploads', 'invoices');
    fs.mkdirSync(invoicesDir, { recursive: true });

    const fileName = `${order.orderNumber}.pdf`;
    const filePath = path.join(invoicesDir, fileName);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);
      doc.fontSize(22).text('BoxEseg Invoice', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#9C6D46').text(`Invoice: ${order.orderNumber}`);
      doc.fillColor('#2E1E16').text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-EG')}`);
      doc.moveDown();

      doc.fontSize(12).text('Bill To', { underline: true });
      doc.text(order.shippingAddress.fullName);
      doc.text(order.shippingAddress.phone);
      doc.text(`${order.shippingAddress.street}, ${order.shippingAddress.city}`);
      doc.moveDown();

      doc.fontSize(12).text('Items', { underline: true });
      order.items.forEach((item) => {
        doc.text(`${item.name} x ${item.quantity} - ${item.lineTotal} EGP`);
      });

      doc.moveDown();
      doc.text(`Subtotal: ${order.subtotal} EGP`);
      doc.text(`Discount: ${order.discount} EGP`);
      doc.fontSize(14).text(`Total: ${order.total} EGP`);
      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return {
      number: order.orderNumber,
      path: `/uploads/invoices/${fileName}`,
      generatedAt: new Date(),
    };
  }
}

module.exports = InvoiceService;
