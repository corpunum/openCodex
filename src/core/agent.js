import { loadConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { MemoryManager } from '../memory/memory.js';

const MAX_ITERATIONS = 50;

export class Agent {
  constructor() {
    this.config = loadConfig();
    this.sessionManager = new SessionManager(this.config.sessionsDir);
    this.memory = new MemoryManager(this.config.memoryDb);
    this.iterationCount = 0;
    this.providerHealthy = true;
  }

  async initialize() {
    await this.sessionManager.initialize();
    await this.memory.initialize();
    await this.runHealthCheck();
    console.log('[Agent] Initialized with', this.config.provider, '/', this.config.model);
  }

  authHeaders(apiKey) {
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  async runHealthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.authHeaders(this.config.apiKey),
        signal: AbortSignal.timeout(5000),
      });
      this.providerHealthy = response.ok;
      if (!response.ok) await this.tryFailover();
    } catch {
      this.providerHealthy = false;
      await this.tryFailover();
    }
  }

  async tryFailover() {
    for (const fallback of this.config.fallbacks) {
      try {
        const response = await fetch(`${fallback.baseUrl}/models`, {
          method: 'GET',
          headers: this.authHeaders(fallback.apiKey),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          this.config.provider = fallback.provider;
          this.config.model = fallback.model;
          this.config.baseUrl = fallback.baseUrl;
          this.config.apiKey = fallback.apiKey;
          this.providerHealthy = true;
          return true;
        }
      } catch {
      }
    }
    return false;
  }

  async chat(userMessage, sessionId = null) {
    let session = sessionId ? await this.sessionManager.load(sessionId) : null;
    if (!session) session = await this.sessionManager.create();

    await this.sessionManager.addMessage(session.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    session = await this.sessionManager.load(session.id);
    const messages = [{ role: 'system', content: this.getSystemPrompt() }];
    for (const msg of session.messages.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const result = await this.runAutonomousLoop(messages);

    await this.sessionManager.addMessage(session.id, {
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
    });

    return { session, response: result.response, actions: result.actions };
  }

  getSystemPrompt() {
    return `You are openCodex, an autonomous coding assistant.
CRITICAL: Operate in autonomous mode. Execute without asking for intermediate approvals.
- Complete end-to-end tasks with tool evidence.
- Prefer deterministic steps and verify outcomes.
- Keep operations inside configured workspace unless explicitly instructed.
Available tools: file, shell, git, browser.`;
  }

  async runAutonomousLoop(messages) {
    this.iterationCount = 0;
    const actions = [];

    while (this.iterationCount < MAX_ITERATIONS) {
      this.iterationCount += 1;
      const response = await this.callModel(messages);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return { response: response.content, actions };
      }

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        actions.push({ tool: toolCall.name, result });
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }

      messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });
    }

    return { response: 'Max iterations reached', actions };
  }

  async callModel(messages) {
    try {
      const body = {
        model: this.config.model,
        messages,
        tools: this.getToolDefinitions(),
        stream: false,
      };

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders(this.config.apiKey),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) throw new Error(`Model API error: ${response.status}`);
      const data = await response.json();
      const msg = data.choices?.[0]?.message || data.message || {};
      const toolCalls = msg.tool_calls || [];

      return {
        content: msg.content || '',
        toolCalls: toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function?.name || tc.name,
          arguments: tc.function?.arguments || tc.arguments || {},
        })),
      };
    } catch (e) {
      await this.tryFailover();
      return { content: `Error: ${e.message}`, toolCalls: [] };
    }
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'file',
          description: 'File operations in workspace only',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'read', 'write', 'delete', 'list'] },
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['action', 'path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'shell',
          description: 'Execute shell commands in workspace',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              cwd: { type: 'string' },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'git',
          description: 'Git operations inside workspace',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              cwd: { type: 'string' },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'browser',
          description: 'Browser automation: fetch, screenshot, extract',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['fetch', 'screenshot', 'extract'] },
              url: { type: 'string' },
              selector: { type: 'string' },
            },
            required: ['action'],
          },
        },
      },
    ];
  }

  async executeTool(toolCall) {
    const { name, arguments: args } = toolCall;

    try {
      const toolModule = await import(`../tools/${name}.js`);
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      const result = await toolModule.execute(parsedArgs || {}, this.config);
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
