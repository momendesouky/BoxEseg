const passport = require('passport');
const env = require('../config/env');
const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

function safeRedirect(target, fallback = '/') {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : fallback;
}

function setAuthSession(req, res, authResult) {
  req.session.userId = authResult.user.id;
  res.cookie('access_token', authResult.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

exports.showRegister = (req, res) => {
  res.render('auth/register', { title: 'Create account' });
};

exports.register = catchAsync(async (req, res) => {
  const authResult = await container.authService.register(req.body);
  setAuthSession(req, res, authResult);
  req.flash('success', 'Welcome to BoxEseg.');
  res.redirect('/products');
});

exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Sign in', next: req.query.next || '' });
};

exports.login = catchAsync(async (req, res) => {
  const authResult = await container.authService.login(req.body);
  setAuthSession(req, res, authResult);
  req.flash('success', 'Signed in successfully.');
  res.redirect('/products');
});

exports.logout = (req, res) => {
  res.clearCookie('access_token');

  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }

    return res.redirect(303, '/');
  });
};

exports.showForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot password' });
};

exports.forgotPassword = catchAsync(async (req, res) => {
  await container.authService.requestPasswordReset(req.body.email);
  req.flash('success', 'If this email exists, a password reset link has been sent.');
  res.redirect('/auth/login');
});

exports.showResetPassword = (req, res) => {
  res.render('auth/reset-password', { title: 'Reset password', token: req.params.token });
};

exports.resetPassword = catchAsync(async (req, res) => {
  await container.authService.resetPassword(req.params.token, req.body.password);
  req.flash('success', 'Your password has been reset. Please sign in.');
  res.redirect('/auth/login');
});

exports.facebookStart = (req, res, next) => {
  if (!env.facebook.appId || !env.facebook.appSecret) {
    req.flash('error', 'Facebook login is not configured yet.');
    return res.redirect('/auth/login');
  }

  return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
};

exports.facebookCallback = (req, res, next) => {
  if (!env.facebook.appId || !env.facebook.appSecret) {
    req.flash('error', 'Facebook login is not configured yet.');
    return res.redirect('/auth/login');
  }

  return passport.authenticate('facebook', {
    failureRedirect: '/auth/login',
    failureFlash: false,
  })(req, res, (error) => {
    if (error) return next(error);
    setAuthSession(req, res, container.authService.buildSession(req.user));
    req.flash('success', 'Signed in with Facebook.');
    return res.redirect('/products');
  });
};

exports.googleStart = (req, res, next) => {
  if (!env.google.clientId || !env.google.clientSecret) {
    req.flash('error', 'Google login is not configured yet.');
    return res.redirect('/auth/login');
  }

  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

exports.googleCallback = (req, res, next) => {
  if (!env.google.clientId || !env.google.clientSecret) {
    req.flash('error', 'Google login is not configured yet.');
    return res.redirect('/auth/login');
  }

  return passport.authenticate('google', {
    failureRedirect: '/auth/login',
    failureFlash: false,
  })(req, res, (error) => {
    if (error) return next(error);
    setAuthSession(req, res, container.authService.buildSession(req.user));
    req.flash('success', 'Signed in with Google.');
    return res.redirect('/products');
  });
};
