const env = require('../config/env');
const { createTransporter, isMailConfigured } = require('../config/mailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = createTransporter();
  }

  async sendMail({ to, subject, html, text }) {
    if (!isMailConfigured() || !this.transporter) {
      logger.warn(`Email skipped because SMTP is not configured: ${subject}`);
      return { skipped: true };
    }

    return this.transporter.sendMail({
      from: env.mail.from,
      to,
      subject,
      html,
      text,
    });
  }

  sendPasswordReset(user, resetUrl) {
    return this.sendMail({
      to: user.email,
      subject: 'Reset your BoxEseg password',
      text: `Open this link to reset your password: ${resetUrl}`,
      html: `<p>Hello ${user.firstName},</p><p>Use this secure link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  sendOrderConfirmation(user, order) {
    return this.sendMail({
      to: user.email,
      subject: `Your BoxEseg order ${order.orderNumber}`,
      text: `Thank you for your order ${order.orderNumber}. Total: ${order.total} EGP.`,
      html: `<p>Hello ${user.firstName},</p><p>Your order <strong>${order.orderNumber}</strong> was received.</p><p>Total: <strong>${order.total} EGP</strong></p>`,
    });
  }
}

module.exports = EmailService;
