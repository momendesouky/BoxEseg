const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/token');
const container = require('../config/container');

async function attachCurrentUser(req, res, next) {
  try {
    let userId = req.session.userId;
    const jwtCookie = req.cookies.access_token;

    if (!userId && jwtCookie) {
      const payload = verifyAccessToken(jwtCookie);
      userId = payload.sub;
    }

    if (userId) {
      req.currentUser = await container.userRepository.findById(userId);
      if (!req.currentUser || !req.currentUser.isActive) {
        req.currentUser = null;
        delete req.session.userId;
      }
    }

    next();
  } catch (error) {
    req.currentUser = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.flash('warning', 'Please sign in to continue.');
    return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
  }

  next();
}

function requireGuest(req, res, next) {
  if (req.currentUser) {
    return res.redirect('/profile');
  }

  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return next(new AppError('Authentication is required.', 401));
    }

    if (!roles.includes(req.currentUser.role)) {
      return next(new AppError('You do not have permission to access this resource.', 403));
    }

    next();
  };
}

module.exports = { attachCurrentUser, requireAuth, requireGuest, authorize };
