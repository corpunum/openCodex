import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildModelCatalog, buildLegacyProviderModels, normalizeProviderId, PROVIDER_ORDER } from '../core/model-catalog.js';
import { getCapabilities } from '../core/capabilities.js';
import { MissionRunner } from '../core/missions.js';
import { UIEventBus } from '../core/ui-events.js';
import { saveConfig } from '../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(JSON.stringify(payload));
}

function normalizeModelForProvider(provider, model) {
  const p = normalizeProviderId(provider);
  const raw = String(model || '').trim();
  if (!raw) return '';
  if (/^(ollama|nvidia|openrouter|openai|generic)\//.test(raw)) return raw.replace(/^generic\//, 'openai/');
  return `${p}/${raw}`;
}

export class UIServer {
  constructor(agent, port = 18882, host = '127.0.0.1') {
    this.agent = agent;
    this.port = port;
    this.host = host;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.eventBus = new UIEventBus(400);
    this.missions = new MissionRunner({ agent: this.agent, eventBus: this.eventBus });
    this.eventBus.on('event', (event) => this.broadcast({ type: 'event', event }));
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
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        const activeProvider = this.agent.config.provider;
        const activeModel = this.agent.config.model;
        return json(res, 200, {
          status: 'ok',
          app: 'openCodex',
          host: this.host,
          port: this.port,
          provider: activeProvider,
          model: activeModel,
          healthy: this.agent.providerHealthy,
          provider_order: [...PROVIDER_ORDER],
          runtime: {
            autonomy_mode: this.agent.config.autonomyMode || 'autonomy-first',
            workspace_root: this.agent.config.workspaceRoot,
            sessions_dir: this.agent.config.sessionsDir,
          },
          timestamp: new Date().toISOString(),
        });
      }

      if (url.pathname === '/api/capabilities' && req.method === 'GET') {
        return json(res, 200, getCapabilities(this.agent.config));
      }

      if (url.pathname === '/api/model-catalog' && req.method === 'GET') {
        const catalog = await buildModelCatalog(this.agent.config);
        return json(res, 200, catalog);
      }

      if (url.pathname === '/api/models' && req.method === 'GET') {
        const provider = normalizeProviderId(url.searchParams.get('provider') || this.agent.config.provider);
        const models = await buildLegacyProviderModels(this.agent.config, provider);
        return json(res, 200, { provider, models });
      }

      if (url.pathname === '/api/config' && req.method === 'GET') {
        const catalog = await buildModelCatalog(this.agent.config);
        return json(res, 200, {
          app_id: 'opencodex',
          providerConfig: {
            provider: this.agent.config.provider,
            model: this.agent.config.model,
            fallbackProvider: this.agent.config.fallbackProvider,
            fallbackModel: this.agent.config.fallbackModel,
            providerModels: this.agent.config.providerModels,
            fallbackOrder: this.agent.config.fallbackOrder,
            autonomyMode: this.agent.config.autonomyMode || 'autonomy-first',
          },
          modelCatalog: catalog,
          capabilities: getCapabilities(this.agent.config),
        });
      }

      if (url.pathname === '/api/config' && req.method === 'POST') {
        const body = await this.readJson(req);
        const provider = normalizeProviderId(body?.providerConfig?.provider || this.agent.config.provider);
        const model = normalizeModelForProvider(provider, body?.providerConfig?.model || this.agent.config.model);
        const fallbackProvider = normalizeProviderId(body?.providerConfig?.fallbackProvider || this.agent.config.fallbackProvider || 'nvidia');
        const fallbackModel = normalizeModelForProvider(
          fallbackProvider,
          body?.providerConfig?.fallbackModel || this.agent.config.fallbackModel || this.agent.config.providerModels?.[fallbackProvider],
        );

        const nextProviderModels = {
          ...(this.agent.config.providerModels || {}),
          ...(body?.providerConfig?.providerModels || {}),
        };

        nextProviderModels[provider] = model;
        nextProviderModels[fallbackProvider] = fallbackModel;

        const updated = saveConfig({
          provider,
          model,
          fallbackProvider,
          fallbackModel,
          providerModels: nextProviderModels,
          fallbackOrder: [...PROVIDER_ORDER],
          autonomyMode: String(body?.providerConfig?.autonomyMode || this.agent.config.autonomyMode || 'autonomy-first'),
        });
        this.agent.config = updated;
        await this.agent.runHealthCheck();
        this.eventBus.push('health.updated', { provider, model, healthy: this.agent.providerHealthy });
        return json(res, 200, { ok: true, providerConfig: {
          provider: updated.provider,
          model: updated.model,
          fallbackProvider: updated.fallbackProvider,
          fallbackModel: updated.fallbackModel,
          providerModels: updated.providerModels,
          fallbackOrder: updated.fallbackOrder,
          autonomyMode: updated.autonomyMode,
        } });
      }

      if (url.pathname === '/api/events' && req.method === 'GET') {
        const prefix = String(url.searchParams.get('prefix') || '').trim();
        const limit = Number(url.searchParams.get('limit') || 120);
        return json(res, 200, { events: this.eventBus.list(prefix, limit) });
      }

      if (url.pathname === '/api/missions' && req.method === 'GET') {
        return json(res, 200, { missions: this.missions.list() });
      }

      if (url.pathname === '/api/missions/start' && req.method === 'POST') {
        const body = await this.readJson(req);
        const out = this.missions.start({
          goal: String(body?.goal || '').trim(),
          maxSteps: Number(body?.maxSteps || 1),
          continueUntilDone: body?.continueUntilDone !== false,
          intervalMs: Number(body?.intervalMs || 0),
        });
        return json(res, 200, out);
      }

      if (url.pathname === '/api/missions/status' && req.method === 'GET') {
        const id = String(url.searchParams.get('id') || '').trim();
        const mission = this.missions.get(id);
        return json(res, mission ? 200 : 404, mission ? { ok: true, mission } : { ok: false, error: 'mission_not_found' });
      }

      if (url.pathname === '/api/missions/stop' && req.method === 'POST') {
        const body = await this.readJson(req);
        const out = this.missions.stop(String(body?.id || '').trim());
        return json(res, out.ok ? 200 : 404, out);
      }

      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = await this.agent.sessionManager.list();
        return json(res, 200, { sessions });
      }

      if (url.pathname === '/api/sessions' && req.method === 'POST') {
        const session = await this.agent.sessionManager.create();
        this.eventBus.push('session.updated', { sessionId: session.id, action: 'create' });
        return json(res, 200, { session });
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        const deleted = await this.agent.sessionManager.delete(id);
        this.eventBus.push('session.updated', { sessionId: id, action: 'delete', deleted });
        return json(res, 200, { deleted });
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        const session = await this.agent.sessionManager.load(id);
        return json(res, 200, { session });
      }

      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const body = await this.readJson(req);
        const sessionId = String(body?.sessionId || '').trim();
        const message = String(body?.message || '').trim();
        if (!sessionId || !message) return json(res, 400, { ok: false, error: 'sessionId_and_message_required' });

        this.eventBus.push('chat.started', { sessionId, provider: this.agent.config.provider, model: this.agent.config.model });
        try {
          const result = await this.agent.chat(message, sessionId);
          const response = String(result?.response || '');
          this.eventBus.push('chat.completed', {
            sessionId,
            provider: this.agent.config.provider,
            model: this.agent.config.model,
            response_chars: response.length,
            actions: Array.isArray(result?.actions) ? result.actions.length : 0,
          });
          return json(res, 200, {
            sessionId,
            response,
            reply: response,
            actions: result?.actions || [],
            provider: this.agent.config.provider,
            model: this.agent.config.model,
          });
        } catch (error) {
          this.eventBus.push('chat.error', { sessionId, error: String(error.message || error) });
          return json(res, 500, { ok: false, error: String(error.message || error) });
        }
      }

      return json(res, 404, { error: 'Not found' });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
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
    const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = join(publicDir, safePath);

    try {
      const content = await readFile(filePath);
      const ext = safePath.split('.').pop().toLowerCase();
      const contentTypes = {
        html: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        json: 'application/json; charset=utf-8',
        png: 'image/png',
        ico: 'image/x-icon',
      };
      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  broadcast(payload) {
    const text = JSON.stringify(payload);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(text);
    }
  }

  handleWebSocket(ws) {
    this.clients.add(ws);
    ws.send(JSON.stringify({ type: 'hello', app: 'openCodex', ts: new Date().toISOString() }));
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(String(data || '{}'));
        if (msg.type === 'chat') {
          const result = await this.agent.chat(String(msg.message || ''), String(msg.sessionId || ''));
          ws.send(JSON.stringify({
            type: 'response',
            sessionId: msg.sessionId,
            response: result?.response || '',
            actions: result?.actions || [],
            provider: this.agent.config.provider,
            model: this.agent.config.model,
          }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: String(e.message || e) }));
      }
    });
    ws.on('close', () => this.clients.delete(ws));
  }
}
