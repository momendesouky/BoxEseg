const http = require('http');

const loginData = 'email=momen%40gmail.com&password=12345678';
const loginReq = http.request({
  hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginData) }
}, (res) => {
  const cookies = res.headers['set-cookie'];
  console.log('Login:', res.statusCode);
  if (!cookies) { console.log('No cookie'); process.exit(1); }
  const cookie = cookies.map(c => c.split(';')[0]).join('; ');

  const boundary = '----TestBoundary' + Date.now();
  let body = '';
  const fields = [
    ['name', 'Test Product HTTP'],
    ['category', '6a7139b5ade4aefd25328f35'],
    ['price', '250'],
    ['stock', '10'],
    ['status', 'draft'],
    ['description', 'A test product'],
  ];
  fields.forEach(([k,v]) => {
    body += '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="' + k + '"\r\n\r\n';
    body += v + '\r\n';
  });
  body += '--' + boundary + '--\r\n';

  const productReq = http.request({
    hostname: 'localhost', port: 3000, path: '/dashboard/products', method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': Buffer.byteLength(body),
      'Cookie': cookie
    }
  }, (pRes) => {
    console.log('Product POST:', pRes.statusCode);
    console.log('Location:', pRes.headers.location || 'none');
    let d = '';
    pRes.on('data', c => d += c);
    pRes.on('end', () => {
      if (pRes.statusCode >= 300 && pRes.statusCode < 400) {
        console.log('Redirect to:', pRes.headers.location);
        console.log('SUCCESS - product created');
      } else {
        console.log('Body (500?):', d.substring(0, 800));
      }
      process.exit(0);
    });
  });
  productReq.write(body);
  productReq.end();
});
loginReq.write(loginData);
loginReq.end();
