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

  // userLike: { email, firstName } — accepts guest objects too.
  sendOtpEmail(userLike, code, purpose) {
    const action =
      purpose === 'checkout'
        ? 'verify your contact before placing your order'
        : 'view your orders';

    return this.sendMail({
      to: userLike.email,
      subject: `Your BoxEseg verification code: ${code}`,
      text: `Your BoxEseg code is ${code}. Use it to ${action}. It expires in ${env.otp.ttlMinutes} minutes.`,
      html: `<p>Hello ${userLike.firstName || 'there'},</p><p>Use this code to ${action}:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in ${env.otp.ttlMinutes} minutes. If you didn't request it, ignore this email.</p>`,
    });
  }

  // guestLike: { name, email, phone }
  sendGuestOrderConfirmation(guestLike, order) {
    return this.sendMail({
      to: guestLike.email,
      subject: `Your BoxEseg order ${order.orderNumber}`,
      text: `Thank you for your order ${order.orderNumber}. Total: ${order.total} EGP. Visit ${env.clientUrl}/orders/guest to view your orders using this email.`,
      html: `<p>Hello ${guestLike.name || 'there'},</p><p>Your order <strong>${order.orderNumber}</strong> was received.</p><p>Total: <strong>${order.total} EGP</strong></p><p>Track your order any time at <a href="${env.clientUrl}/orders/guest">${env.clientUrl}/orders/guest</a> using this email.</p>`,
    });
  }
}

module.exports = EmailService;
