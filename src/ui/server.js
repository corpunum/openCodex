/**
 * UI Server - WebSocket + REST API
 * Port 18882
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class UIServer {
  constructor(agent, port = 18882) {
    this.agent = agent;
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
  }

  async start() {
    // HTTP server for static files + API
    this.server = createServer((req, res) => this.handleRequest(req, res));

    // WebSocket server for chat
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleWebSocket(ws));

    // Start server
    await new Promise((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[UI] Server running at http://127.0.0.1:${this.port}`);
        resolve();
      });
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return this.handleApi(req, res, url);
    }

    // Static files
    if (req.method === 'GET') {
      return this.serveStatic(res, url.pathname);
    }

    res.writeHead(404);
    res.end('Not found');
  }

  async handleApi(req, res, url) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      // GET /api/sessions
      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = await this.agent.sessionManager.list();
        return res.end(JSON.stringify({ sessions }));
      }

      // POST /api/sessions
      if (url.pathname === '/api/sessions' && req.method === 'POST') {
        const session = await this.agent.sessionManager.create();
        return res.end(JSON.stringify({ session }));
      }

      // DELETE /api/sessions/:id
      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        const deleted = await this.agent.sessionManager.delete(id);
        return res.end(JSON.stringify({ deleted }));
      }

      // GET /api/sessions/:id
      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        const session = await this.agent.sessionManager.load(id);
        return res.end(JSON.stringify({ session }));
      }

      // POST /api/chat
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const body = await this.readJson(req);
        const result = await this.agent.chat(body.message, body.sessionId);
        return res.end(JSON.stringify(result));
      }

      // GET /api/health
      if (url.pathname === '/api/health') {
        return res.end(JSON.stringify({
          status: 'ok',
          provider: this.agent.config.model,
          healthy: this.agent.providerHealthy
        }));
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
      console.error('[API] Error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  async readJson(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  async serveStatic(res, pathname) {
    const publicDir = join(__dirname, 'public');
    let filePath = join(publicDir, pathname === '/' ? 'index.html' : pathname);

    try {
      const content = await readFile(filePath);
      const ext = pathname.split('.').pop();
      const contentTypes = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'ico': 'image/x-icon'
      };
      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  handleWebSocket(ws) {
    this.clients.add(ws);
    console.log('[WS] Client connected');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'chat') {
          const result = await this.agent.chat(msg.message, msg.sessionId);
          ws.send(JSON.stringify({ type: 'response', ...result }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log('[WS] Client disconnected');
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }
}
