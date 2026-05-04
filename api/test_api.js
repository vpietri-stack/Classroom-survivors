const http = require('http');

const req = http.request({
    hostname: 'localhost',
    port: 7071,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Body:", data);
    });
});

req.write(JSON.stringify({ login: 'test1', password: 'test1' }));
req.end();
