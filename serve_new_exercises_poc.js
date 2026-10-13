'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const port = Number(process.argv[2] || 8123);
const files = {
  '/new_exercises_poc.html': ['new_exercises_poc.html', 'text/html; charset=utf-8'],
  '/new_exercises_poc.css': ['new_exercises_poc.css', 'text/css; charset=utf-8'],
  '/new_exercises_poc.js': ['new_exercises_poc.js', 'text/javascript; charset=utf-8'],
  '/non_spelling_content.js': ['non_spelling_content.js', 'text/javascript; charset=utf-8'],
  '/non_spelling_widget.js': ['non_spelling_widget.js', 'text/javascript; charset=utf-8'],
  '/non_spelling_exercises.css': ['non_spelling_exercises.css', 'text/css; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/lib/tailwind.js': ['lib/tailwind.js', 'text/javascript; charset=utf-8'],
  '/lib/fontawesome/css/all.min.css': ['lib/fontawesome/css/all.min.css', 'text/css; charset=utf-8'],
  '/fonts/fonts.css': ['fonts/fonts.css', 'text/css; charset=utf-8'],
  '/fonts/Nunito-700-latin.woff2': ['fonts/Nunito-700-latin.woff2', 'font/woff2'],
  '/fonts/Fredoka-600-latin.woff2': ['fonts/Fredoka-600-latin.woff2', 'font/woff2']
};
for (const name of fs.readdirSync(path.join(__dirname, 'fonts'))) {
  if (name.endsWith('.woff2')) files['/fonts/' + name] = ['fonts/' + name, 'font/woff2'];
}
for (const name of fs.readdirSync(path.join(__dirname, 'lib/fontawesome/webfonts'))) {
  if (name.endsWith('.woff2')) files['/lib/fontawesome/webfonts/' + name] = ['lib/fontawesome/webfonts/' + name, 'font/woff2'];
}
http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  let pathname;
  try { pathname = new URL(request.url, 'http://localhost').pathname; }
  catch { response.writeHead(400); response.end(); return; }
  if (pathname === '/') { response.writeHead(302, { Location: '/new_exercises_poc.html' }); response.end(); return; }
  const asset = files[pathname];
  if (!asset) { response.writeHead(404); response.end('Not found'); return; }
  fs.readFile(path.join(__dirname, asset[0]), (error, body) => {
    if (error) { response.writeHead(500); response.end('Could not read the test page'); return; }
    response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
}).listen(port, '0.0.0.0', () => {
  console.log('PC: http://localhost:' + port + '/new_exercises_poc.html');
  for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) {
    if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) {
      console.log('LAN: http://' + entry.address + ':' + port + '/new_exercises_poc.html');
    }
  }
});
