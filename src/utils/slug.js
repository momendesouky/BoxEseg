const slugify = require('slugify');

function makeSlug(value) {
  return slugify(value || '', {
    lower: true,
    strict: true,
    trim: true,
  });
}

module.exports = { makeSlug };
