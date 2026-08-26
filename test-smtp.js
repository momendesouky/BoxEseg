require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

async function test() {
  try {
    await transporter.verify();
    console.log('SMTP connection OK');

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SMTP_USER,
      subject: 'BoxEseg SMTP Test',
      text: 'If you see this, email works!',
    });
    console.log('Email sent:', info.messageId);
  } catch (err) {
    console.error('SMTP FAILED:', err.message);
  }
  process.exit();
}

test();
