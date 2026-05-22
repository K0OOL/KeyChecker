#!/usr/bin/env node
// Simple static server for OpenRouter Key Tester
// Usage: node server.js [port]

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3737;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ┌──────────────────────────────────────┐`);
  console.log(`  │   OpenRouter Key Tester              │`);
  console.log(`  │   http://localhost:${PORT}             │`);
  console.log(`  └──────────────────────────────────────┘`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
