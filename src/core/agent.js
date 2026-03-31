/**
 * Autonomous Agent Core
 * NO approvals - executes tasks immediately after planning
 */

import { loadConfig } from './config.js';
import { SessionManager } from './session-manager.js';

const MAX_ITERATIONS = 50;
const MAX_TOOL_USES = 12;

export class Agent {
  constructor(options = {}) {
    this.config = loadConfig();
    this.sessionManager = new SessionManager();
    this.sessionHistory = [];
    this.toolCounts = new Map();
    this.iterationCount = 0;
    this.providerHealthy = true;
  }

  async initialize() {
    await this.sessionManager.initialize();
    await this.runHealthCheck();
    console.log('[Agent] Initialized with', this.config.provider, '/', this.config.model);
  }

  async runHealthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.config.provider === 'ollama' ? {} : {
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      });
      this.providerHealthy = response.ok;
      if (!response.ok) {
        console.warn('[Health] Provider check failed:', response.status);
        await this.tryFailover();
      }
    } catch (e) {
      console.warn('[Health] Provider unreachable:', e.message);
      this.providerHealthy = false;
      await this.tryFailover();
    }
  }

  async tryFailover() {
    for (const fallback of this.config.fallbacks) {
      try {
        const response = await fetch(`${fallback.baseUrl}/models`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          console.log('[Failover] Switched to', fallback.model);
          this.config.provider = fallback.provider;
          this.config.model = fallback.model;
          this.config.baseUrl = fallback.baseUrl;
          this.providerHealthy = true;
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async chat(userMessage, sessionId = null) {
    // Load or create session
    let session;
    if (sessionId) {
      session = await this.sessionManager.load(sessionId);
    }
    if (!session) {
      session = await this.sessionManager.create();
    }

    // Add user message to session
    await this.sessionManager.addMessage(session.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    // Build conversation history
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...session.messages.slice(-20) // Last 20 messages
    ];

    // Run autonomous loop
    const result = await this.runAutonomousLoop(messages, session.id);

    // Add assistant response to session
    await this.sessionManager.addMessage(session.id, {
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString()
    });

    return {
      session,
      response: result.response,
      actions: result.actions
    };
  }

  getSystemPrompt() {
    return `You are openCodex, an autonomous coding assistant.
CRITICAL: You operate in AUTO-APPROVE mode. Never ask for permission.
- Plan and execute tasks immediately
- Use tools without confirmation
- Complete full tasks, not partial
- Report results clearly

Available tools: file operations, shell commands, git, browser automation, research.
Focus on coding tasks: create, edit, debug, test, deploy.`;
  }

  async runAutonomousLoop(messages, sessionId) {
    this.iterationCount = 0;
    const actions = [];

    while (this.iterationCount < MAX_ITERATIONS) {
      this.iterationCount++;

      // Call model
      const response = await this.callModel(messages);

      // Check if done (no tool calls)
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return { response: response.content, actions };
      }

      // Execute tools (auto-approve, no confirmation)
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        actions.push({ tool: toolCall.name, result });
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id
        });
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });
    }

    return { response: 'Max iterations reached', actions };
  }

  async callModel(messages) {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: false
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!response.ok) {
        throw new Error(`Model API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.message?.content || '',
        toolCalls: data.message?.tool_calls || []
      };
    } catch (e) {
      console.error('[Model] Call failed:', e.message);
      await this.tryFailover();
      return { content: `Error: ${e.message}`, toolCalls: [] };
    }
  }

  async executeTool(toolCall) {
    const { name, arguments: args } = toolCall;
    console.log('[Tool] Executing:', name, args);

    try {
      // Dynamic tool import
      const toolModule = await import(`../tools/${name}.js`);
      const result = await toolModule.execute(args);
      return { success: true, result };
    } catch (e) {
      console.error('[Tool] Execution failed:', name, e.message);
      return { success: false, error: e.message };
    }
  }
}
