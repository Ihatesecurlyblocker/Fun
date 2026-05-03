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
    return /^[a-z-]+-[a-z-]+-\d{4}$/.test(p);
  };

  // Middleware to handle subdomain-to-path routing
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    const parts = host.split('.');
    
    // Check if the first part is a slug (e.g., air-max-retro-0000.ais-dev...)
    // We expect at least 3 parts for a subdomain on ais-dev.whatever.run.app
    if (parts.length > 2 && isPortalSlug(parts[0])) {
      const slug = parts[0];
      req.url = `/links/${slug}${req.url}`;
      console.log(`Subdomain detected [${slug}]. Internal rewrite to ${req.url}`);
    } else {
      // Fallback: check Referer to associate root-level assets with a portal
      const referer = req.headers.referer || '';
      const slugMatch = referer.match(/\/links\/([a-z-]+-[a-z-]+-\d{4})/);
      if (slugMatch && !req.path.startsWith('/links') && !req.path.startsWith('/proxy') && !req.path.startsWith('/api') && !req.path.startsWith('/@vite')) {
        const slug = slugMatch[1];
        // Only rewrite if it's likely an asset or relative fetch
        req.url = `/links/${slug}${req.url}`;
        console.log(`Referer fallback [${slug}]. Rewriting ${req.path} -> ${req.url}`);
      }
    }
    next();
  });

  // The proxy logic
  app.all(['/links/:slug', '/links/:slug/:path(*)', '/proxy', '/proxy/:path(*)'], async (req, res) => {
    try {
      const targetBase = 'https://nikehub.pages.dev';
      const targetDomain = 'nikehub.pages.dev';
      const currentHost = req.headers.host || '';
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      
      let slug = req.params.slug || '';
      let fullRemainingPath = req.params.path || '';

      // Force trailing slash for base portal path to ensure relative links work
      if (slug && !req.path.endsWith('/') && !req.params.path) {
        return res.redirect(301, `${req.path}/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
      }

      // Fallback for /proxy/... 
      if (!slug && req.path.startsWith('/proxy')) {
        const pathAfterProxy = req.params.path || '';
        const pathParts = pathAfterProxy.split('/');
        if (isPortalSlug(pathParts[0])) {
          slug = pathParts[0];
          pathParts.shift();
          fullRemainingPath = pathParts.join('/');
        }
      }

      // Re-normalize path
      const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      let targetPath = fullRemainingPath.startsWith('/') ? fullRemainingPath : '/' + fullRemainingPath;
      
      // Ensure targetPath doesn't double slash and is at least /
      if (targetPath === '//' || targetPath === '') targetPath = '/';
      
      const targetUrl = new URL(targetBase + targetPath + search).toString();

      console.log(`Proxying: [${slug || 'root'}] ${req.url} -> ${targetUrl}`);

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
        redirect: 'manual', 
      });

      const responseHeaders = new Headers();
      response.headers.forEach((v, k) => {
        const key = k.toLowerCase();
        if (['content-security-policy', 'x-frame-options', 'content-encoding', 'transfer-encoding', 'connection'].includes(key)) return;
        responseHeaders.set(k, v);
      });

      // Handle Redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          try {
            const locUrl = new URL(location, targetBase);
            if (locUrl.host === targetDomain) {
              const isSubdomainRequest = isPortalSlug(currentHost.split('.')[0]);
              let newLocation = '';
              
              if (isSubdomainRequest) {
                // If the user already hit a subdomain, stay on it (browsers handle this fine)
                newLocation = `${locUrl.pathname}${locUrl.search}`;
              } else if (slug) {
                // Fallback to path-based
                newLocation = `/links/${slug}${locUrl.pathname}${locUrl.search}`;
              } else {
                newLocation = `/proxy${locUrl.pathname}${locUrl.search}`;
              }
              responseHeaders.set('location', newLocation);
            }
          } catch (e) {
            // ignore malformed
          }
        }
      }

      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      responseHeaders.set('X-Frame-Options', 'ALLOWALL');
      responseHeaders.set('Content-Security-Policy', "frame-ancestors *");
      responseHeaders.set('Cache-Control', 'no-store, no-cache');

      res.status(response.status);
      responseHeaders.forEach((v, k) => res.setHeader(k, v));

      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const isText = isHtml || contentType.includes('text/css') || contentType.includes('javascript');

      if (isText) {
        let text = await response.text();

        // Safety Transform: Disable autocomplete
        if (isHtml) {
          text = text.replace(/<form/gi, '<form autocomplete="off"');
          text = text.replace(/<input/gi, '<input autocomplete="off"');
          
          // Inject <base> tag and a script to fix links that escape the proxy
          const isSubdomainRequest = isPortalSlug(currentHost.split('.')[0]);
          const baseHref = isSubdomainRequest ? '/' : `/links/${slug}/`;
          
          if (!text.includes('<base')) {
            const scriptTag = `
<script>
  (function() {
    const slug = "${slug}";
    const isSubdomain = ${isSubdomainRequest};
    if (!slug || isSubdomain) return; 
    const prefix = "/links/" + slug;
    document.addEventListener("click", e => {
      const link = e.target.closest("a");
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        const url = new URL(link.href);
        if (!url.pathname.startsWith(prefix) && !url.pathname.startsWith("/proxy")) {
          url.pathname = prefix + (url.pathname.startsWith("/") ? "" : "/") + url.pathname;
          link.href = url.toString();
        }
      }
    }, true);
  })();
</script>`;
            text = text.replace(/<head>/i, `<head><base href="${baseHref}">${scriptTag}`);
          }
        }

        // Replace absolute domain strings
        const isSubdomainRequest = isPortalSlug(currentHost.split('.')[0]);
        let replacementBase = '';
        
        if (isSubdomainRequest) {
          replacementBase = '/'; 
        } else {
          replacementBase = slug ? `/links/${slug}` : `/proxy`;
        }
        
        // 1. Replace absolute domain strings (catch both http and https)
        text = text.replace(new RegExp('https?://' + targetDomain.replace(/\./g, '\\.'), 'g'), replacementBase);
        text = text.replace(new RegExp('//' + targetDomain.replace(/\./g, '\\.'), 'g'), replacementBase);

        // 2. Rewrite root-relative links if in path-mode
        if (!isSubdomainRequest && slug) {
          const prefix = `/links/${slug}`;
          // Improved regex to handle spaces and different attribute quotes
          text = text.replace(/(href|src|action|data-href)\s*=\s*(["'])\/([^"'>]*)\2/gi, (match, attr, quote, path) => {
            // Don't replace if it already starts with our prefix
            if (path.startsWith('links/') || path.startsWith('proxy/')) return match;
            // Also avoid replacing external links that happen to start with / (unlikely with this regex but safe)
            return `${attr}=${quote}${prefix}/${path}${quote}`;
          });
        }
        
        res.send(text);
      } else {
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
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
