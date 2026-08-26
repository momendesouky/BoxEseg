const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { signAccessToken, createPlainToken, hashToken } = require('../utils/token');

class AuthService {
  constructor({ userRepository, passwordResetTokenRepository, emailService }) {
    this.userRepository = userRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.emailService = emailService;
  }

  async register(payload) {
    const email = payload.email.toLowerCase().trim();
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError('An account with this email already exists.', 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await this.userRepository.create({
      firstName: payload.firstName.trim(),
      lastName: (payload.lastName || '').trim(),
      email,
      phone: payload.phone,
      passwordHash,
      provider: 'local',
    });

    return this.buildSession(user);
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email, true);

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (!user.isActive) {
      throw new AppError('This account is disabled.', 403);
    }

    await this.userRepository.markLogin(user.id);
    return this.buildSession(user);
  }

  async loginWithOAuth(provider, profile) {
    const fallbackDomain = provider === 'google' ? 'google.local' : 'facebook.local';
    const fallbackName = provider === 'google' ? 'Google User' : 'Facebook User';
    const email = profile.emails?.[0]?.value?.toLowerCase() || `${profile.id}@${fallbackDomain}`;
    const photoUrl = profile.photos?.[0]?.value;
    let user = await this.userRepository.findByProvider(provider, profile.id);

    if (!user) {
      user = await this.userRepository.findByEmail(email);
    }

    if (user) {
      return this.userRepository.updateById(user.id, {
        provider,
        providerId: profile.id,
        avatar: photoUrl ? { url: photoUrl } : user.avatar,
        lastLoginAt: new Date(),
      });
    }

    const [firstName, ...rest] = (profile.displayName || fallbackName).split(' ');

    return this.userRepository.create({
      firstName,
      lastName: rest.join(' '),
      email,
      provider,
      providerId: profile.id,
      avatar: photoUrl ? { url: photoUrl } : undefined,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });
  }

  async requestPasswordReset(email) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return;
    }

    await this.passwordResetTokenRepository.deleteForUser(user.id);

    const token = createPlainToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.passwordResetTokenRepository.create({
      user: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${env.clientUrl}/auth/reset-password/${token}`;
    this.emailService.sendPasswordReset(user, resetUrl).catch((err) => {
      const logger = require('../utils/logger');
      logger.error(`Password reset email failed for ${email}: ${err.message}`);
    });
  }

  async resetPassword(token, password) {
    const resetToken = await this.passwordResetTokenRepository.findValid(hashToken(token));

    if (!resetToken) {
      throw new AppError('Password reset link is invalid or expired.', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.userRepository.updateById(resetToken.user, { passwordHash });
    await this.passwordResetTokenRepository.markUsed(resetToken.id);
  }

  buildSession(user) {
    return {
      user,
      token: signAccessToken(user),
    };
  }
}

module.exports = AuthService;
