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

  // The proxy logic based on user request
  app.all('/proxy/*', async (req, res) => {
    try {
      const targetBase = 'https://nikehub.pages.dev';
      // extract the remaining path after /proxy/
      const remainingPath = req.params[0] || '';
      const search = new URL(req.url, `http://${req.headers.host}`).search;
      const targetUrl = new URL(remainingPath + search, targetBase).toString();

      const headers = new Headers();
      // Copy incoming headers but filter out some
      Object.entries(req.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        }
      });

      headers.delete('cf-connecting-ip');
      headers.delete('x-forwarded-for');
      headers.delete('host'); // Ensure fetch uses target host
      headers.set('referer', targetBase);
      headers.set('origin', targetBase);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: headers,
        // body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined, // Express req is a stream
        redirect: 'follow',
      });

      // Special handling for bodies if needed, but for now let's pipe the response
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      responseHeaders.delete('x-frame-options');
      responseHeaders.delete('content-security-policy');
      responseHeaders.set('x-frame-options', 'ALLOW');
      responseHeaders.set('cache-control', 'no-store, no-cache');

      res.status(response.status);
      responseHeaders.forEach((v, k) => res.setHeader(k, v));

      // Proxy the body
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Proxy error');
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
