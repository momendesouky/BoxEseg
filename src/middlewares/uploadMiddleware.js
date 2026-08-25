const multer = require('multer');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }

  cb(new AppError('Only image uploads are allowed.', 400));
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8,
  },
});

module.exports = { upload };
