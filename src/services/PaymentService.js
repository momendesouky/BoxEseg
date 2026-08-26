const fetch = require('node-fetch');
const https = require('https');
const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const paymobAgent = new https.Agent({ keepAlive: true, timeout: 10000 });
const PAYMOB_TIMEOUT = 10000;

class PaymentService {
  isPaymobConfigured() {
    return Boolean(env.paymob.apiKey);
  }

  ensurePaymobConfigured(method) {
    if (!env.paymob.apiKey) {
      throw new AppError('Paymob API key is not configured.', 500);
    }
    if (method === 'paymob_card' && (!env.paymob.integrationIdCard || !env.paymob.iframeId)) {
      throw new AppError('Paymob card credentials are not configured.', 500);
    }
    if (method === 'paymob_wallet' && !env.paymob.integrationIdWallet) {
      throw new AppError('Paymob wallet credentials are not configured.', 500);
    }
  }

  async paymobPost(url, body, label) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        agent: paymobAgent,
        timeout: PAYMOB_TIMEOUT,
      });
    } catch (err) {
      logger.error(`Paymob ${label}: network error — ${err.message}`);
      throw new AppError(`Paymob ${label}: could not connect to Paymob (${err.message})`, 502);
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      logger.error(`Paymob ${label}: invalid JSON response — HTTP ${res.status}`);
      throw new AppError(`Paymob ${label}: invalid response from Paymob (HTTP ${res.status})`, 502);
    }

    logger.info(`Paymob ${label}: HTTP ${res.status}`);

    if (!res.ok) {
      const detail = data.message || data.detail || data.code || JSON.stringify(data);
      logger.error(`Paymob ${label}: HTTP ${res.status} — ${detail}`);
      throw new AppError(`Paymob ${label} failed (HTTP ${res.status}): ${detail}`, 502);
    }

    return data;
  }

  buildBillingData(order) {
    const billing = order.shippingAddress;
    const nameParts = (billing.fullName || '').split(' ');
    return {
      apartment: billing.building || 'NA',
      email: order.user.email || 'customer@boxseg.local',
      floor: 'NA',
      first_name: nameParts[0] || 'Customer',
      street: billing.street,
      building: billing.building || 'NA',
      phone_number: billing.phone,
      shipping_method: 'NA',
      postal_code: 'NA',
      city: billing.city,
      country: 'EG',
      last_name: nameParts.slice(1).join(' ') || 'Customer',
      state: billing.area || billing.city,
    };
  }

  async createPaymobCardPayment(order) {
    this.ensurePaymobConfigured('paymob_card');

    logger.info(`Paymob card flow: starting for order ${order.orderNumber}, integration=${env.paymob.integrationIdCard}`);

    const auth = await this.paymobPost(
      'https://accept.paymob.com/api/auth/tokens',
      { api_key: env.paymob.apiKey },
      'auth'
    );
    logger.info(`Paymob card flow: auth OK`);

    const registration = await this.paymobPost(
      'https://accept.paymob.com/api/ecommerce/orders',
      {
        auth_token: auth.token,
        delivery_needed: false,
        amount_cents: Math.round(order.total * 100),
        currency: 'EGP',
        merchant_order_id: order.orderNumber,
        items: [],
      },
      'register order'
    );

    if (!registration.id) {
      logger.error(`Paymob card flow: registration returned no id — ${JSON.stringify(registration)}`);
      throw new AppError('Paymob order registration failed: no order id returned.', 502);
    }
    logger.info(`Paymob card flow: order registered, paymob_order_id=${registration.id}`);

    const paymentKey = await this.paymobPost(
      'https://accept.paymob.com/api/acceptance/payment_keys',
      {
        auth_token: auth.token,
        amount_cents: Math.round(order.total * 100),
        expiration: 3600,
        order_id: registration.id,
        billing_data: this.buildBillingData(order),
        currency: 'EGP',
        integration_id: Number(env.paymob.integrationIdCard),
      },
      'payment key'
    );

    if (!paymentKey.token) {
      logger.error(`Paymob card flow: payment key returned no token`);
      throw new AppError('Paymob payment key failed: no token returned.', 502);
    }
    logger.info(`Paymob card flow: payment key OK, iframe=${env.paymob.iframeId}`);

    const url = `https://accept.paymob.com/api/acceptance/iframes/${env.paymob.iframeId}?payment_token=${paymentKey.token}`;
    return url;
  }

  async createPaymobWalletPayment(order) {
    this.ensurePaymobConfigured('paymob_wallet');

    logger.info(`Paymob wallet flow: starting for order ${order.orderNumber}, integration=${env.paymob.integrationIdWallet}`);

    const auth = await this.paymobPost(
      'https://accept.paymob.com/api/auth/tokens',
      { api_key: env.paymob.apiKey },
      'auth'
    );
    logger.info(`Paymob wallet flow: auth OK`);

    const registration = await this.paymobPost(
      'https://accept.paymob.com/api/ecommerce/orders',
      {
        auth_token: auth.token,
        delivery_needed: false,
        amount_cents: Math.round(order.total * 100),
        currency: 'EGP',
        merchant_order_id: order.orderNumber,
        items: [],
      },
      'register order'
    );

    if (!registration.id) {
      logger.error(`Paymob wallet flow: registration returned no id`);
      throw new AppError('Paymob order registration failed: no order id returned.', 502);
    }
    logger.info(`Paymob wallet flow: order registered, paymob_order_id=${registration.id}`);

    const paymentKey = await this.paymobPost(
      'https://accept.paymob.com/api/acceptance/payment_keys',
      {
        auth_token: auth.token,
        amount_cents: Math.round(order.total * 100),
        expiration: 3600,
        order_id: registration.id,
        billing_data: this.buildBillingData(order),
        currency: 'EGP',
        integration_id: Number(env.paymob.integrationIdWallet),
      },
      'payment key'
    );

    if (!paymentKey.token) {
      logger.error(`Paymob wallet flow: payment key returned no token`);
      throw new AppError('Paymob payment key failed: no token returned.', 502);
    }
    logger.info(`Paymob wallet flow: payment key OK`);

    return { token: paymentKey.token };
  }

  async createAndPayWallet(order, identifier) {
    this.ensurePaymobConfigured('paymob_wallet');

    logger.info(`Paymob wallet full flow: starting for order ${order.orderNumber}, identifier=${identifier}`);

    const auth = await this.paymobPost(
      'https://accept.paymob.com/api/auth/tokens',
      { api_key: env.paymob.apiKey },
      'wallet auth'
    );

    const paymobOrder = await this.paymobPost(
      'https://accept.paymob.com/api/ecommerce/orders',
      {
        auth_token: auth.token,
        delivery_needed: false,
        amount_cents: Math.round(order.total * 100),
        currency: 'EGP',
        merchant_order_id: `${order.orderNumber}-W${Date.now()}`,
        items: [],
      },
      'wallet register order'
    );

    const paymentKey = await this.paymobPost(
      'https://accept.paymob.com/api/acceptance/payment_keys',
      {
        auth_token: auth.token,
        amount_cents: Math.round(order.total * 100),
        expiration: 3600,
        order_id: paymobOrder.id,
        billing_data: this.buildBillingData(order),
        currency: 'EGP',
        integration_id: Number(env.paymob.integrationIdWallet),
      },
      'wallet payment key'
    );

    logger.info(`Paymob wallet full flow: payment key OK, calling /payments/pay`);

    let payRes;
    try {
      payRes = await fetch('https://accept.paymob.com/api/acceptance/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: {
            identifier: identifier,
            subtype: 'WALLET',
          },
          payment_token: paymentKey.token,
        }),
        agent: paymobAgent,
        timeout: PAYMOB_TIMEOUT,
      });
    } catch (err) {
      logger.error(`Paymob wallet full flow: network error — ${err.message}`);
      throw new AppError(`Paymob wallet pay: network error (${err.message})`, 502);
    }

    const payData = await payRes.json();
    logger.info(`Paymob wallet full flow: HTTP ${payRes.status} — ${JSON.stringify(payData)}`);

    if (!payRes.ok) {
      const detail = payData.message || payData.detail || JSON.stringify(payData);
      logger.error(`Paymob wallet full flow: HTTP ${payRes.status} — ${detail}`);
      throw new AppError(`Paymob wallet pay failed (${payRes.status}): ${detail}`, 502);
    }

    return payData;
  }

  verifyPaymobHmac(payload) {
    if (!env.paymob.hmacSecret || !payload.hmac) {
      return false;
    }

    const orderedKeys = [
      'amount_cents',
      'created_at',
      'currency',
      'error_occured',
      'has_parent_transaction',
      'id',
      'integration_id',
      'is_3d_secure',
      'is_auth',
      'is_capture',
      'is_refunded',
      'is_standalone_payment',
      'is_voided',
      'order',
      'owner',
      'pending',
      'source_data.pan',
      'source_data.sub_type',
      'source_data.type',
      'success',
    ];

    const source = orderedKeys.map((key) => this.resolvePayloadValue(payload, key)).join('');
    const digest = crypto.createHmac('sha512', env.paymob.hmacSecret).update(source).digest('hex');

    return digest === payload.hmac;
  }

  resolvePayloadValue(payload, path) {
    return path.split('.').reduce((current, key) => (current ? current[key] : ''), payload) ?? '';
  }
}

module.exports = PaymentService;
