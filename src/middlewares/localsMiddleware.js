const viewHelpers = require('../helpers/viewHelpers');

module.exports = function localsMiddleware(req, res, next) {
  res.locals.currentUser = req.currentUser || null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query || {};
  res.locals.site = {
    name: 'BoxEseg',
    email: 'sales@boxseg.com',
    phone: '+20 100 000 0000',
    location: 'Giza, Egypt',
  };
  res.locals.helpers = viewHelpers;
  next();
};
