const { Resend } = require('resend');
const env = require('./env');

let resendClient = null;

function isMailConfigured() {
  return Boolean(env.mail.resendApiKey);
}

function getResendClient() {
  if (!resendClient && env.mail.resendApiKey) {
    resendClient = new Resend(env.mail.resendApiKey);
  }
  return resendClient;
}

function createTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  const client = getResendClient();
  return {
    sendMail: ({ from, to, subject, html, text }) =>
      client.emails.send({ from: from || env.mail.from, to, subject, html, text }),
  };
}

module.exports = { createTransporter, isMailConfigured };
