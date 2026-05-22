#!/usr/bin/env node
// OpenRouter Key Tester — local proxy server
// Usage: node server.js [port]

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3737;
const DIR = __dirname;
const MAX_BODY_SIZE = 256 * 1024; // 256KB
const UPSTREAM_TIMEOUT_MS = 15000;
const SAFE_STATIC_PATH = /^[A-Za-z0-9._/-]+$/;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

function isSafeOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function deriveOriginFromHost(hostHeader) {
  if (typeof hostHeader !== 'string' || !hostHeader.trim()) return 'http://localhost';
  const host = hostHeader.split(',')[0].trim();
  try {
    return new URL(`http://${host}`).origin;
  } catch {
    return 'http://localhost';
  }
}

const server = http.createServer((req, res) => {
  const json = (statusCode, payload) => {
    if (res.writableEnded) return;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

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
    let bodySize = 0;
    let bodyTooLarge = false;

    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        json(413, { error: { message: 'Request body too large.' } });
        req.pause();
        return;
      }
      body += chunk;
    });

    req.on('error', () => {
      if (!bodyTooLarge) json(400, { error: { message: 'Invalid request body.' } });
    });

    req.on('end', () => {
      if (bodyTooLarge) return;

      let payload;
      try { payload = JSON.parse(body); } catch {
        json(400, { error: { message: 'Invalid JSON body.' } });
        return;
      }

      const { apiKey, origin, ...rest } = payload;
      if (!apiKey) {
        json(401, { error: { message: 'No API key provided.' } });
        return;
      }

      const referer = isSafeOrigin(origin)
        ? new URL(origin).origin
        : deriveOriginFromHost(req.headers.host);

      const reqBody = JSON.stringify(rest);
      const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        timeout: UPSTREAM_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqBody),
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': referer,
          'X-Title': 'OR Key Tester',
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          if (res.writableEnded) return;
          res.writeHead(proxyRes.statusCode || 502, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error('Upstream timeout'));
        json(504, { error: { message: 'Upstream request timed out. Please try again.' } });
      });

      proxyReq.on('error', err => {
        if (res.writableEnded) return;
        json(502, { error: { message: `Proxy error: ${err.message}` } });
      });

      proxyReq.write(reqBody);
      proxyReq.end();
    });
    return;
  }

  // Catch stray POST requests — never serve HTML for them
  if (req.method === 'POST') {
    json(404, { error: { message: 'Unknown endpoint.' } });
    return;
  }

  // Static file serving
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (/(^|\/)\.\.(\/|$)/.test(decodedPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const normalizedPath = path.posix.normalize(decodedPath);
  if (normalizedPath.includes('\\') || normalizedPath.includes('\0')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');
  if (
    !SAFE_STATIC_PATH.test(relativePath)
    || relativePath === '..'
    || relativePath.startsWith('../')
    || relativePath.includes('/../')
  ) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = path.resolve(DIR, path.normalize(relativePath));
  const rootPath = path.resolve(DIR);
  const relativeToRoot = path.relative(rootPath, filePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ┌──────────────────────────────────────┐`);
  console.log(`  │   OpenRouter Key Tester              │`);
  console.log(`  │   http://localhost:${PORT}             │`);
  console.log(`  └──────────────────────────────────────┘`);
  console.log(`\n  Requests proxied server-side. Press Ctrl+C to stop.\n`);
});
