require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGO_URI || process.env.MONGO_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'replace-this-session-secret',
  jwtSecret: process.env.JWT_SECRET || 'replace-this-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'replace-this-cookie-secret',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'boxseg/products',
  },
  mail: {
    from: process.env.MAIL_FROM || 'BoxEseg <no-reply@boxseg.local>',
    resendApiKey: process.env.RESEND_API_KEY || '',
  },
  paymob: {
    apiKey: process.env.PAYMOB_API_KEY || '',
    integrationIdCard: process.env.PAYMOB_INTEGRATION_ID_CARD || '',
    integrationIdWallet: process.env.PAYMOB_INTEGRATION_ID_WALLET || '',
    iframeId: process.env.PAYMOB_IFRAME_ID || '',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
    callbackUrl: process.env.PAYMOB_CALLBACK_URL || '',
    webhookUrl: process.env.PAYMOB_WEBHOOK_URL || '',
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/auth/facebook/callback',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  },
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = env;
