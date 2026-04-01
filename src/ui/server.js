import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class UIServer {
  constructor(agent, port = 18882, host = '127.0.0.1') {
    this.agent = agent;
    this.port = port;
    this.host = host;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
  }

  async start() {
    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleWebSocket(ws));

    await new Promise((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${this.host}:${this.port}`);
    if (url.pathname.startsWith('/api/')) return this.handleApi(req, res, url);
    if (req.method === 'GET') return this.serveStatic(res, url.pathname);
    res.writeHead(404);
    res.end('Not found');
  }

  async handleApi(req, res, url) {
    res.setHeader('Content-Type', 'application/json');

    try {
      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = await this.agent.sessionManager.list();
        return res.end(JSON.stringify({ sessions }));
      }
      if (url.pathname === '/api/sessions' && req.method === 'POST') {
        const session = await this.agent.sessionManager.create();
        return res.end(JSON.stringify({ session }));
      }
      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        const deleted = await this.agent.sessionManager.delete(id);
        return res.end(JSON.stringify({ deleted }));
      }
      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        const session = await this.agent.sessionManager.load(id);
        return res.end(JSON.stringify({ session }));
      }
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const body = await this.readJson(req);
        const result = await this.agent.chat(body.message, body.sessionId);
        return res.end(JSON.stringify(result));
      }
      if (url.pathname === '/api/health') {
        return res.end(JSON.stringify({
          status: 'ok',
          app: 'openCodex',
          provider: this.agent.config.provider,
          model: this.agent.config.model,
          healthy: this.agent.providerHealthy,
        }));
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  async readJson(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  async serveStatic(res, pathname) {
    const publicDir = join(__dirname, 'public');
    const safePath = pathname === '/' ? 'index.html' : pathname;
    const filePath = join(publicDir, safePath);

    try {
      const content = await readFile(filePath);
      const ext = safePath.split('.').pop().toLowerCase();
      const contentTypes = {
        html: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        json: 'application/json',
        png: 'image/png',
        ico: 'image/x-icon',
      };
      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  handleWebSocket(ws) {
    this.clients.add(ws);
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
    ws.on('close', () => this.clients.delete(ws));
  }
}
