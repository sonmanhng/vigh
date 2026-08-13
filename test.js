const http = require('http');
http.get('http://localhost:3000/api/stationeries', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', data));
}).on('error', err => console.log('ERR:', err.message));
