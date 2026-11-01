import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const ipv4Agent = new https.Agent({
  keepAlive: true,
  family: 4, // Force IPv4 to bypass broken ISP IPv6 routing to Google APIs
});

const DB_FILE_PATH = path.resolve(process.cwd(), 'pos-server-db.json');

function readServerDb(): Record<string, any> | null {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore read error
  }
  return null;
}

function writeServerDb(data: Record<string, any>) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'pos-server-api',
      configureServer(server) {
        server.middlewares.use('/api/pos', (req, res) => {
          const url = req.url || '/';
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET' && url.startsWith('/state')) {
            const db = readServerDb();
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, data: db }));
            return;
          }

          if (req.method === 'POST' && url.startsWith('/sync')) {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                const current = readServerDb() || {};
                const nextDb = {
                  ...current,
                  ...body,
                  updatedAt: new Date().toISOString(),
                };
                writeServerDb(nextDb);
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true, updatedAt: nextDb.updatedAt }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: err?.message || 'Invalid JSON' }));
              }
            });
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: 'Not found' }));
        });
      },
    },
    {
      name: 'gemini-ipv4-proxy',
      configureServer(server) {
        server.middlewares.use('/api/gemini', (req, res) => {
          const targetPath = req.url || '/';
          const chunks: Buffer[] = [];

          req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          req.on('end', () => {
            const bodyBuffer = Buffer.concat(chunks);
            const proxyReq = https.request(
              {
                hostname: 'generativelanguage.googleapis.com',
                port: 443,
                path: targetPath,
                method: req.method || 'POST',
                family: 4,
                agent: ipv4Agent,
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': bodyBuffer.length,
                },
                timeout: 10000,
              },
              (proxyRes) => {
                res.statusCode = proxyRes.statusCode || 500;
                res.setHeader('Content-Type', 'application/json');
                proxyRes.pipe(res);
              }
            );

            proxyReq.on('timeout', () => {
              proxyReq.destroy(new Error('Upstream IPv4 timeout'));
            });

            proxyReq.on('error', (err) => {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: { message: `Proxy IPv4 error: ${err.message}` },
                })
              );
            });

            if (bodyBuffer.length > 0) {
              proxyReq.write(bodyBuffer);
            }
            proxyReq.end();
          });
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
});
