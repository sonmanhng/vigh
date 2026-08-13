const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:3000/api/auth/login', { username: 'admin', password: 'password123' });
    const token = res.data.token;
    const res2 = await axios.get('http://localhost:3000/api/stationeries', { headers: { Authorization: `Bearer ${token}` } });
    console.log(res2.data);
  } catch (err) {
    console.log('Error:', err.response?.data || err.message);
  }
})();
