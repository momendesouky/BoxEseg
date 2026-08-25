function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    data,
  });
}

function redirectWithFlash(req, res, path, type, message) {
  req.flash(type, message);
  return res.redirect(path);
}

module.exports = { sendSuccess, redirectWithFlash };
