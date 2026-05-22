#!/usr/bin/env node
// OpenRouter Key Tester — local proxy server
// Usage: node server.js [port]

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3737;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
  // CORS for local use
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy: POST /proxy  →  OpenRouter API
  const urlPath = req.url.split('?')[0]; // strip query string
  if (req.method === 'POST' && urlPath === '/proxy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { apiKey, ...rest } = payload;
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'No API key provided.' } }));
        return;
      }

      const reqBody = JSON.stringify(rest);
      const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqBody),
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'OR Key Tester',
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      proxyReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }));
      });

      proxyReq.write(reqBody);
      proxyReq.end();
    });
    return;
  }

  // Catch stray POST requests — never serve HTML for them
  if (req.method === 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Unknown endpoint.' } }));
    return;
  }

  // Static file serving
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ┌──────────────────────────────────────┐`);
  console.log(`  │   OpenRouter Key Tester              │`);
  console.log(`  │   http://localhost:${PORT}             │`);
  console.log(`  └──────────────────────────────────────┘`);
  console.log(`\n  Requests proxied server-side. Press Ctrl+C to stop.\n`);
});
