/**
 * Configuration for openCodex
 * Auto-approve mode, cloud models, no user input required
 */

export const CONFIG = {
  // Primary model
  provider: 'ollama',
  model: 'qwen3.5:397b-cloud',
  baseUrl: 'http://localhost:11434',
  apiKey: '', // Not needed for local ollama cloud proxy
  
  // Fallback models
  fallbacks: [
    { provider: 'ollama', model: 'minimax-m2.7:cloud', baseUrl: 'http://localhost:11434' },
    { provider: 'ollama', model: 'kimi-k2.5:cloud', baseUrl: 'http://localhost:11434' },
  ],
  
  // Server config
  port: 18882,
  host: '127.0.0.1',
  
  // Auto-approve mode - NO user input ever
  autoApprove: true,
  
  // Agent limits
  maxIterations: 50,
  maxToolUses: 12,
  maxToolFailures: 3,
  
  // Context
  maxContextTokens: 262144,
  compactionThreshold: 0.8,
  
  // Paths
  dataDir: './data',
  sessionsDir: './data/sessions',
  logsDir: './logs',
  memoryDb: './data/memory.db',
};

export function loadConfig() {
  return { ...CONFIG };
}

export function getConfig() {
  return CONFIG;
}
