module.exports = function flashMiddleware(req, res, next) {
  req.flash = (type, message) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };

  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  next();
};
