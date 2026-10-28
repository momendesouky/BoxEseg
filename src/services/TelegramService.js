const env = require('../config/env');
const logger = require('../utils/logger');

// Free OTP + notification delivery over the official Telegram Bot API.
//
// How a guest links their chat: the verify page shows a one-time link code;
// the guest opens our bot (t.me/<botUsername>) and sends that code as a
// message. A background poller reads getUpdates, matches the message, and
// resolves the sender's chat id — from then on codes/confirmations are
// delivered to that chat at no cost.
class TelegramService {
  constructor() {
    this.botToken = env.telegram.botToken;
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
    this.staticBotUsername = env.telegram.botUsername || '';
    this.pendingLinks = new Map(); // linkCode → { resolve, timer, settled }
    this.lastUpdateId = 0;
    this.polling = false;
    this.pollTimer = null;
    this.webhookCleanupDone = false;
    this._mePromise = null;
  }

  isConfigured() {
    return Boolean(this.botToken);
  }

  // Resolved once via getMe and cached; bots always have a username.
  async getBotUsername() {
    if (this.staticBotUsername) return this.staticBotUsername;
    if (!this.isConfigured()) return null;

    if (!this._mePromise) {
      this._mePromise = this.apiCall('getMe')
        .then((me) => {
          if (me && me.username) return me.username;
          return null;
        })
        .catch((err) => {
          logger.error(`Telegram getMe failed: ${err.message}`);
          this._mePromise = null; // allow a later retry
          return null;
        });
    }

    return this._mePromise;
  }

  async send(chatId, message) {
    if (!this.isConfigured()) {
      throw new Error('Telegram is not configured.');
    }

    await this.apiCall('sendMessage', {
      chat_id: chatId,
      text: message,
    });

    return { sent: true, provider: 'telegram', chatId };
  }

  /**
   * Waits (up to timeoutMs) for a guest to message the bot with `linkCode`.
   * Returns { chatId } of the sender or null when nobody sent it in time.
   */
  async waitForChat(linkCode, timeoutMs = 12000) {
    if (!this.isConfigured()) {
      throw new Error('Telegram is not configured.');
    }

    const code = String(linkCode).toUpperCase();
    const existing = this.pendingLinks.get(code);

    // A previous waiter for the same code is still active — piggyback on it
    // and resolve with whatever that wait produces (outcome is set on settle).
    if (existing && !existing.settled) {
      return new Promise((resolve) => {
        existing.lateWaiters.push(() => resolve(existing.outcome));
      });
    }

    const entry = { settled: false, outcome: null, lateWaiters: [], timer: null, resolve: null };
    this.pendingLinks.set(code, entry);

    await new Promise((resolve) => {
      entry.resolve = resolve;
      entry.timer = setTimeout(() => this.settleLink(code, null), timeoutMs);
      this.ensureLoop();
    });

    return entry.outcome;
  }

  settleLink(code, outcome) {
    const entry = this.pendingLinks.get(code);
    if (!entry || entry.settled) return;

    entry.settled = true;
    entry.outcome = outcome;
    if (entry.timer) clearTimeout(entry.timer);
    for (const waiter of entry.lateWaiters) waiter(outcome);
    entry.lateWaiters = [];
    if (entry.resolve) entry.resolve();
    this.pendingLinks.delete(code);
  }

  // ── background getUpdates loop ───────────────────────────────────────────

  ensureLoop() {
    if (this.polling || !this.isConfigured()) return;
    this.polling = true;
    this.tick();
  }

  async tick() {
    if (!this.pendingLinks.size) {
      this.polling = false;
      return;
    }

    try {
      const updates = await this.apiCall('getUpdates', {
        offset: this.lastUpdateId,
        timeout: 0,
        limit: 100,
      });

      for (const update of updates) {
        this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id + 1);
        const message = update.message;
        if (!message || !message.text) continue;

        const text = message.text.trim().toUpperCase();
        const entry = this.pendingLinks.get(text);
        if (entry && !entry.settled) {
          this.settleLink(text, { chatId: message.chat.id, firstName: message.chat.first_name || '' });
        }
      }
    } catch (err) {
      // A leftover webhook makes getUpdates fail with 409 — clear it once.
      if (/webhook/i.test(err.message) && !this.webhookCleanupDone) {
        this.webhookCleanupDone = true;
        try {
          await this.apiCall('deleteWebhook', { drop_pending_updates: false });
        } catch (cleanupErr) {
          logger.error(`Telegram deleteWebhook failed: ${cleanupErr.message}`);
        }
      } else {
        logger.error(`Telegram getUpdates failed: ${err.message}`);
      }
    }

    this.pollTimer = setTimeout(() => this.tick(), 1500);
  }

  async apiCall(method, payload = null) {
    const options = { method: 'GET' };

    if (payload) {
      options.method = 'POST';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(`${this.apiBase}/${method}`, options);
    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = { ok: false, description: `HTTP ${response.status}` };
    }

    if (!response.ok || !body.ok) {
      throw new Error(`Telegram ${method} failed: ${body.description || response.status}`);
    }

    return body.result;
  }
}

module.exports = TelegramService;
