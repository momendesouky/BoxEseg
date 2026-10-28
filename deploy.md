# BoxEseg — Production Deployment Guide (Hostinger or any Node host)

## Requirements
- Node.js **v18+** (20/22 LTS recommended) — VPS / Cloud plan (shared PHP hosting won't run this).
- MongoDB Atlas cluster (same one used in dev is fine).
- A local **Chromium-based browser** on the server for invoice PDFs (see step 4).

## 1. Get the code on the server
```bash
# VPS: clone or upload the project, then
npm ci --omit=dev      # or: npm install
```

## 2. Create the production `.env` (never copy the dev secrets blindly)
```ini
NODE_ENV=production
PORT=3000
CLIENT_URL=https://boxeseg.com

MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.../boxseg
SESSION_SECRET=<new random string>
JWT_SECRET=<new random string>
COOKIE_SECRET=<new random string>

# Email OTP (Resend)
MAIL_FROM=BoxEseg <no-reply@boxeseg.com>
RESEND_API_KEY=<key>

# Telegram OTP (free) — same bot you already created
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_BOT_USERNAME=BoxesEg_bot

# SMS provider not configured on purpose (logger = dev only notices, no sends)
SMS_PROVIDER=logger

# Paymob / Facebook / Google keys as needed. Leave DNS_SERVERS UNSET on the
# server (that override is only for this dev PC's broken DNS).
```

## 3. Database access
MongoDB Atlas → Network Access → allow the server's IP (VPS IP or 0.0.0.0/0 + strong creds).

## 4. Invoice PDFs (Chromium on Linux)
```bash
apt install -y chromium
# already auto-detected at /usr/bin/chromium — or point explicitly via .env:
# INVOICE_CHROMIUM_PATH=/usr/bin/chromium
```
The invoice template loads the Cairo (Arabic) webfont from Google Fonts, so Arabic
renders correctly even without system fonts. Optional safety net:
`apt install -y fonts-noto`.

## 5. Run it — pm2 keeps it alive across reboots
```bash
npm install -g pm2
pm2 start server.js --name boxseg
pm2 save && pm2 startup   # auto-start on boot
```

## 6. Reverse proxy + HTTPS (Hostinger panel or nginx)
- Point the domain at the app; enable SSL.
- In nginx, proxy `client_max_body_size 25m;` (product images) to `http://127.0.0.1:3000`.
- The session cookie uses `secure: 'auto'` — over HTTPS it is sent correctly without config changes.

## 7. External services pointing to the domain
- **Paymob**: transaction callbacks/webhook → `https://boxeseg.com/payments/...`.
- **Facebook/Google OAuth**: add `https://boxeseg.com/auth/<provider>/callback` in each dev console.

## Notes / known limits
- Only **one app instance** may run: the Telegram OTP linker polls `getUpdates`
  (single-consumer). Scale horizontally only by moving that poller to its own service.
- Invoice PDFs are written to `src/public/uploads/invoices/` on local disk (persistent on a VPS).
- The Telegram OTP fast path (no link step) is per customer phone — nothing to migrate.
