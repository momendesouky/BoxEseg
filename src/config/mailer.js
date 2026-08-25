const nodemailer = require('nodemailer');
const env = require('./env');

function isMailConfigured() {
  return Boolean(env.mail.host && env.mail.user && env.mail.pass);
}

function createTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.pass,
    },
  });
}

module.exports = { createTransporter, isMailConfigured };
