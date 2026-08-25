const catchAsync = require('../utils/catchAsync');
const container = require('../config/container');

exports.show = (req, res) => {
  res.render('profile/show', { title: 'Profile' });
};

exports.updateProfile = catchAsync(async (req, res) => {
  req.currentUser = await container.userService.updateProfile(req.currentUser.id, req.body);
  req.flash('success', 'Profile updated.');
  res.redirect('/profile');
});

exports.updatePassword = catchAsync(async (req, res) => {
  await container.userService.updatePassword(req.currentUser.id, req.body);
  req.flash('success', 'Password updated.');
  res.redirect('/profile');
});
