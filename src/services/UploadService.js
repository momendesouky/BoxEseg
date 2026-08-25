const streamifier = require('streamifier');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const env = require('../config/env');
const AppError = require('../utils/AppError');

class UploadService {
  async uploadImages(files = []) {
    if (!files.length) {
      return [];
    }

    if (!isCloudinaryConfigured) {
      throw new AppError('Cloudinary credentials are required to upload images.', 500);
    }

    const uploads = await Promise.all(files.map((file) => this.uploadBuffer(file)));

    return uploads.map((upload, index) => ({
      url: upload.secure_url,
      publicId: upload.public_id,
      alt: files[index].originalname,
      isPrimary: index === 0,
    }));
  }

  uploadBuffer(file) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: env.cloudinary.folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}

module.exports = UploadService;
