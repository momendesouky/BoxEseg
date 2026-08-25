function formatMoney(amount = 0, currency = 'EGP') {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function asset(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

function isActive(currentPath, targetPath) {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function queryString(currentQuery, overrides = {}) {
  const params = new URLSearchParams();
  const merged = { ...currentQuery, ...overrides };

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

module.exports = { formatMoney, asset, isActive, queryString };
