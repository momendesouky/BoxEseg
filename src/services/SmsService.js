const env = require('../config/env');
const logger = require('../utils/logger');

// Sends SMS through whichever provider is configured via SMS_PROVIDER.
// - "logger" (default, free for development): logs the message, no real send.
// - "smsmisr": Egyptian gateway (SMSMisr / eSMS EgyptNext). Real SMS to Egyptian numbers.
// - "twilio": international gateway (trial accounts only mail to verified numbers).
class SmsService {
  async send({ to, message }) {
    const phone = this.normalize(to);

    if (!phone) {
      throw new Error('SMS requires a valid phone number.');
    }

    switch (env.sms.provider) {
      case 'smsmisr':
        await this.sendViaSmsMisr(phone, message);
        return { sent: true, provider: 'smsmisr', to: phone };
      case 'twilio':
        await this.sendViaTwilio(phone, message);
        return { sent: true, provider: 'twilio', to: phone };
      case 'logger':
      default:
        logger.info(`[SMS:logger] to=${phone} message="${message}"`);
        // Dev convenience: capture OTP text to a file (same pattern as wallet-debug.log)
        try {
          const fs = require('fs');
          const path = require('path');
          fs.appendFileSync(path.join(__dirname, '..', '..', 'otp-debug.log'), `[${new Date().toISOString()}] to=${phone} | ${message}\n`);
        } catch (_) {}
        return { sent: false, skipped: true, provider: 'logger', to: phone };
    }
  }

  async sendViaSmsMisr(phone, message) {
    const { smsMisrUsername, smsMisrPassword, smsMisrSender } = env.sms;

    if (!smsMisrUsername || !smsMisrPassword) {
      throw new Error('SMSMisr credentials are not configured.');
    }

    const params = new URLSearchParams({
      envl: '1', // 1 = production
      username: smsMisrUsername,
      password: smsMisrPassword,
      sender: smsMisrSender || env.sms.senderName,
      mobiles: phone, // e.g. 201xxxxxxxxx
      sms: message,
      language: '2', // 2 = universal/unicode not needed; 1 = English
    });

    const response = await fetch(`https://smsmisr.com/api/send/?${params.toString()}`);
    const body = await response.text();

    if (!response.ok || !/^\d{4}/.test(body.trim())) {
      // SMSMisr returns numeric codes: 1901 = ok, anything else is an error
      logger.error(`SMSMisr send failed: status=${response.status} body=${body}`);
      throw new Error('SMS gateway rejected the message.');
    }

    logger.info(`SMSMisr send OK: to=${phone} code=${body.trim()}`);
  }

  async sendViaTwilio(phone, message) {
    const { twilioAccountSid, twilioAuthToken, twilioFromNumber } = env.sms;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      throw new Error('Twilio credentials are not configured.');
    }

    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
    const body = new URLSearchParams({
      To: `+${phone}`,
      From: twilioFromNumber,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      logger.error(`Twilio send failed: status=${response.status} body=${err}`);
      throw new Error('SMS gateway rejected the message.');
    }

    logger.info(`Twilio send OK: to=${phone}`);
  }

  // Egypt mobile normalization: strips separators, resolves 0/+20 prefixes,
  // returns 12-digit "20xxxxxxxxxx" or '' when it does not look Egyptian/mobile.
  normalize(input) {
    const digits = String(input || '').replace(/\D/g, '');

    if (!digits) {
      return '';
    }

    if (digits.startsWith('20')) {
      return digits.length === 12 && /^20(10|11|12|15)/.test(digits) ? digits : digits;
    }

    if (digits.startsWith('0') && digits.length === 11 && /^0(10|11|12|15)/.test(digits)) {
      return `20${digits.slice(1)}`;
    }

    if (digits.length === 10 && /^(10|11|12|15)/.test(digits)) {
      return `20${digits}`;
    }

    return digits;
  }
}

module.exports = SmsService;
