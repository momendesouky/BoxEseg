# Credentials Guide

Keep real credentials only in `.env`. The application already reads all provider values from `src/config/env.js`.

## MongoDB Atlas

1. In Atlas, open your project, go to Database > Clusters, and click Connect.
2. Choose Drivers, select Node.js, copy the `mongodb+srv://...` URI, and replace the username/password placeholders.
3. Add your current server IP to Network Access and use a database user with the smallest permissions needed.
4. Put the value in `MONGO_URI`.

Source: [MongoDB Atlas driver connection docs](https://www.mongodb.com/docs/atlas/driver-connection/).

## Cloudinary

1. Open the Cloudinary Console.
2. Go to Settings > API Keys.
3. Copy Cloud Name, API Key, and API Secret.
4. Fill `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

Source: [Cloudinary credentials FAQ](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials).

## Facebook Login

1. Go to the Meta for Developers app dashboard and create/select your app.
2. Add the Facebook Login product.
3. In app settings, copy App ID and App Secret into `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.
4. In Facebook Login settings, add these Valid OAuth Redirect URIs:
   - Local: `http://localhost:3000/auth/facebook/callback`
   - Production: `https://your-domain.com/auth/facebook/callback`
5. Set `FACEBOOK_CALLBACK_URL` to the matching URL.

Reference: [MongoDB App Services Facebook auth docs](https://www.mongodb.com/docs/atlas/app-services/authentication/facebook/) describe the Facebook app, Facebook Login setup, and valid redirect URI requirement. Meta docs were rate-limited during verification, so also check the live Meta dashboard labels before production.

## Google Sign-In

1. Open Google Cloud Console and create/select a project.
2. Configure the OAuth consent screen.
3. Go to APIs & Services > Credentials > Create Credentials > OAuth client ID.
4. Choose Web application and add these authorized redirect URIs:
   - Local: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
5. Copy Client ID and Client Secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Set `GOOGLE_CALLBACK_URL` to the matching callback URL.

Source: [Google OAuth web server docs](https://developers.google.com/identity/protocols/oauth2/web-server).

## Paymob

1. From the Paymob dashboard, create/enable the card integration for your merchant account.
2. Copy the API key, card integration ID, iframe ID, and HMAC secret.
3. Fill `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_IFRAME_ID`, and `PAYMOB_HMAC_SECRET`.
4. Configure callback/webhook URLs:
   - Customer redirect: `https://your-domain.com/payments/paymob/callback`
   - Backend webhook: `https://your-domain.com/payments/paymob/webhook`

Sources: [Paymob API flow](https://developers.paymob.com/paymob-docs/integration-paths/apis), [Paymob checkout experiences](https://developers.paymob.com/paymob-docs/developers/checkout-experiences), and [Paymob HMAC docs](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac).

## SMTP / Nodemailer

Use any SMTP provider for production. Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.

For Gmail testing, use OAuth 2.0 or a Google App Password with 2-Step Verification enabled. Gmail is not ideal for production transactional mail.

Sources: [Nodemailer SMTP transport](https://nodemailer.com/smtp) and [Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail).

## Local Setup

1. Copy `.env.example` to `.env`.
2. Put your `MONGO_URI` and provider credentials in `.env`.
3. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

4. Seed starter shop data:

```bash
npm run seed
```

5. Create or promote an admin user:

```bash
npm run create-admin
```

Because the MongoDB URL was shared in chat, create a fresh Atlas database user/password before production and replace the current one.
