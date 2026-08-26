const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const methodOverride = require('method-override');
const morgan = require('morgan');
const passport = require('passport');

const env = require('./config/env');
const configurePassport = require('./config/passport');
const routes = require('./routes');
const { generalLimiter } = require('./middlewares/rateLimiter');
const { attachCurrentUser } = require('./middlewares/authMiddleware');
const flashMiddleware = require('./middlewares/flashMiddleware');
const localsMiddleware = require('./middlewares/localsMiddleware');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();
configurePassport(passport);

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://accept.paymob.com', 'https://accept.paymobsolutions.com'],
      },
    },
  })
);
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(generalLimiter);
app.use(morgan(env.isProduction ? 'combined' : 'dev', { stream: logger.stream }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(env.cookieSecret));
app.use(methodOverride('_method'));
app.use(
  session({
    name: 'boxseg.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: env.mongoUri
      ? MongoStore.create({
          mongoUrl: env.mongoUri,
          collectionName: 'sessions',
          ttl: 60 * 60 * 24 * 14,
        })
      : undefined,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.use(flashMiddleware);
app.use(attachCurrentUser);
app.use(localsMiddleware);
app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
