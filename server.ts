import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Helper to check if a path is a portal slug
  const isPortalSlug = (p: string) => {
    // Pattern: category-trait-number
    return /^[a-z-]+-[a-z-]+-\d{4}$/.test(p);
  };

  // The proxy logic based on user request
  app.all('/proxy/:path(*)', async (req, res) => {
    try {
      const targetBase = 'https://nikehub.pages.dev';
      let remainingPath = req.params.path || '';
      
      // If it's one of our 100k portal slugs, we proxy to the root of the target
      // This allows the "100,000 links" to all work as entry points.
      if (isPortalSlug(remainingPath)) {
        remainingPath = '';
      }

      // Ensure proper path joining
      const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      
      // Construct target URL carefully
      let targetPath = remainingPath.startsWith('/') ? remainingPath : '/' + remainingPath;
      const targetUrl = new URL(targetBase + targetPath + search).toString();

      console.log(`Proxying: ${req.url} -> ${targetUrl}`);

      const headers = new Headers();
      const forbiddenHeaders = [
        'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
        'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
        'cf-connecting-ip', 'x-forwarded-for'
      ];

      Object.entries(req.headers).forEach(([key, value]) => {
        if (forbiddenHeaders.includes(key.toLowerCase())) return;
        if (typeof value === 'string') headers.set(key, value);
        else if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
      });

      headers.set('referer', targetBase + '/');
      headers.set('origin', targetBase);
      headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: headers,
        redirect: 'follow',
      });

      console.log(`Response: ${targetUrl} [${response.status}]`);

      const responseHeaders = new Headers();
      response.headers.forEach((v, k) => {
        const key = k.toLowerCase();
        if (['content-security-policy', 'x-frame-options', 'content-encoding', 'transfer-encoding', 'connection'].includes(key)) return;
        responseHeaders.set(k, v);
      });

      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      responseHeaders.set('X-Frame-Options', 'ALLOWALL');
      responseHeaders.set('Content-Security-Policy', "frame-ancestors *");
      responseHeaders.set('Cache-Control', 'no-store, no-cache');

      res.status(response.status);
      responseHeaders.forEach((v, k) => res.setHeader(k, v));

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Proxy error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  // API to get random strings for links (illustrative for "100,000 links")
  app.get('/api/links-seed', (req, res) => {
    res.json({ seed: 'nike-hub-portal-' + Date.now() });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
