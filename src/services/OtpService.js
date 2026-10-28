const crypto = require('crypto');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const logger = require('../utils/logger');

function otpCode(digits) {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, '0');
}

function otpHash(code, contact) {
  return crypto
    .createHash('sha256')
    .update(`${contact}:${code}:${env.jwtSecret}`)
    .digest('hex');
}

// Issues and verifies one-time codes for guest email/phone verification
// (checkout contact proof + guest order tracking).
class OtpService {
  constructor({ otpRepository, emailService, smsService, telegramService }) {
    this.otpRepository = otpRepository;
    this.emailService = emailService;
    this.smsService = smsService;
    this.telegramService = telegramService;
  }

  /**
   * contact: email address or Egyptian phone (any common format).
   * channel: 'email' | 'sms' | 'telegram' — telegram needs a linked chat id
   * (see TelegramService) and delivers the code free of charge.
   * Returns the verification row so callers can show masked contact + resend state.
   */
  async sendOtp({ contactType, contact, purpose, channel, telegramChatId }) {
    const normalized = contactType === 'email' ? contact.toLowerCase().trim() : contact;
    const deliveryChannel = channel || (contactType === 'email' ? 'email' : 'sms');

    // Resend cooldown — protects the SMS/email quota from spam.
    const recent = await this.otpRepository.findMostRecent(contactType, normalized, purpose);
    if (recent) {
      const since = Date.now() - new Date(recent.lastSentAt).getTime();
      if (since < env.otp.resendCooldownSeconds * 1000) {
        const wait = Math.ceil((env.otp.resendCooldownSeconds * 1000 - since) / 1000);
        throw new AppError(`Please wait ${wait}s before requesting another code.`, 429);
      }
    }

    const code = otpCode(env.otp.digits);
    const now = new Date();

    // invalidate older un-consumed codes for the same contact+purpose
    await this.otpRepository.invalidateFor(contactType, normalized, purpose);

    let record = await this.otpRepository.create({
      contactType,
      contact: normalized,
      purpose,
      codeHash: otpHash(code, normalized),
      expiresAt: new Date(now.getTime() + env.otp.ttlMinutes * 60 * 1000),
      lastSentAt: now,
    });

    const message = `Your BoxEseg verification code is ${code}. It expires in ${env.otp.ttlMinutes} minutes.`;

    try {
      if (deliveryChannel === 'telegram') {
        if (!telegramChatId || !this.telegramService) {
          throw new Error('Telegram delivery requires a linked chat id.');
        }
        await this.telegramService.send(telegramChatId, message);
      } else if (contactType === 'email') {
        await this.emailService.sendOtpEmail({ email: normalized }, code, purpose);
      } else {
        await this.smsService.send({ to: contact, message });
      }
    } catch (err) {
      logger.error(`OTP delivery failed for ${contactType}/${deliveryChannel} ${normalized}: ${err.message}`);
      throw new AppError('Could not send the verification code. Please try again.', 502);
    }

    return record;
  }

  /**
   * Verifies the supplied code. Throws AppError on wrong/expired codes with
   * attempt counting so brute force is blocked. Consumes the row on success.
   */
  async verifyOtp({ contactType, contact, purpose, code }) {
    const normalized = contactType === 'email' ? contact.toLowerCase().trim() : contact;
    const record = await this.otpRepository.findActive(contactType, normalized, purpose);

    if (!record) {
      throw new AppError('The code is incorrect or has expired. Please request a new one.', 400);
    }

    if (record.attempts >= env.otp.maxAttempts) {
      throw new AppError('Too many wrong attempts. Please request a new code.', 429);
    }

    if (record.codeHash !== otpHash(code, normalized)) {
      record.attempts += 1;
      await record.save();
      throw new AppError(
        `Incorrect code. ${env.otp.maxAttempts - record.attempts} attempt(s) remaining.`,
        400
      );
    }

    record.verifiedAt = new Date();
    record.consumedAt = new Date();
    await record.save();

    return {
      contactType,
      contact: normalized,
      verifiedAt: record.verifiedAt,
    };
  }

  mask(contact, contactType) {
    if (contactType === 'email') {
      const [user, domain] = contact.split('@');
      if (!domain) return contact;
      const visible = user.slice(0, 2);
      return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
    }

    const digits = contact.replace(/\D/g, '');
    return `+${digits.slice(0, 4)}${'*'.repeat(Math.max(digits.length - 8, 3))}${digits.slice(-4)}`;
  }
}

module.exports = OtpService;
