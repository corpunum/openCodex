import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ensureAppDirs, getRepoRoot } from './paths.js';

const DEFAULTS = {
  appId: 'opencodex',
  provider: process.env.PROVIDER || 'ollama',
  model: process.env.MODEL || 'ollama/qwen3.5:397b-cloud',

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',

  ollamaApiKey: process.env.OLLAMA_API_KEY || 'ollama-local',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  fallbackOrder: (process.env.FALLBACK_ORDER || 'ollama,nvidia,openrouter,openai')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  fallbackProvider: process.env.FALLBACK_PROVIDER || 'nvidia',
  fallbackModel: process.env.FALLBACK_MODEL || 'nvidia/meta/llama-3.1-405b-instruct',

  providerModels: {
    ollama: process.env.OLLAMA_MODEL || 'ollama/qwen3.5:397b-cloud',
    nvidia: process.env.NVIDIA_MODEL || 'nvidia/meta/llama-3.1-405b-instruct',
    openrouter: process.env.OPENROUTER_MODEL || 'openrouter/anthropic/claude-3.5-sonnet',
    openai: process.env.OPENAI_MODEL || 'openai/gpt-5.4',
  },

  port: Number(process.env.OPENCODEX_PORT || 18882),
  host: process.env.OPENCODEX_HOST || '127.0.0.1',

  autoApprove: true,
  autonomyMode: process.env.OPENCODEX_AUTONOMY_MODE || 'autonomy-first',
  maxIterations: 50,
  maxToolUses: 12,
  maxToolFailures: 3,
  maxContextTokens: 262144,
  compactionThreshold: 0.8,
  workspaceRoot: process.env.OPENCODEX_WORKSPACE || getRepoRoot(),
};

function getProviderEnvConfig(cfg, provider) {
  if (provider === 'ollama') return { baseUrl: cfg.ollamaBaseUrl, apiKey: cfg.ollamaApiKey };
  if (provider === 'openrouter') return { baseUrl: cfg.openrouterBaseUrl, apiKey: cfg.openrouterApiKey };
  if (provider === 'nvidia') return { baseUrl: cfg.nvidiaBaseUrl, apiKey: cfg.nvidiaApiKey };
  return { baseUrl: cfg.openaiBaseUrl, apiKey: cfg.openaiApiKey };
}

function normalizeProvider(provider) {
  const p = String(provider || 'ollama').trim().toLowerCase();
  return p === 'generic' ? 'openai' : p;
}

function normalizeModel(provider, model, providerModels) {
  const normalizedProvider = normalizeProvider(provider);
  const fallback = providerModels?.[normalizedProvider] || DEFAULTS.providerModels[normalizedProvider] || DEFAULTS.model;
  const raw = String(model || fallback).trim();
  if (!raw) return fallback;
  if (/^(ollama|nvidia|openrouter|openai|generic)\//.test(raw)) return raw.replace(/^generic\//, 'openai/');
  return `${normalizedProvider}/${raw}`;
}

function withDerived(raw) {
  const dirs = ensureAppDirs();
  const provider = normalizeProvider(raw.provider || 'ollama');
  const active = getProviderEnvConfig(raw, provider);
  const normalizedProviderModels = {
    ollama: normalizeModel('ollama', raw.providerModels?.ollama, raw.providerModels),
    nvidia: normalizeModel('nvidia', raw.providerModels?.nvidia, raw.providerModels),
    openrouter: normalizeModel('openrouter', raw.providerModels?.openrouter, raw.providerModels),
    openai: normalizeModel('openai', raw.providerModels?.openai, raw.providerModels),
  };
  const model = normalizeModel(provider, raw.model, normalizedProviderModels);
  const fallbackProvider = normalizeProvider(raw.fallbackProvider || raw.fallbackOrder?.find((p) => p !== provider) || DEFAULTS.fallbackProvider);
  const fallbackModel = normalizeModel(fallbackProvider, raw.fallbackModel, normalizedProviderModels);

  const normalized = {
    ...DEFAULTS,
    ...raw,
    ...dirs,
    provider,
    model,
    fallbackProvider,
    fallbackModel,
    providerModels: normalizedProviderModels,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    dataDir: dirs.dataDir,
    logsDir: dirs.logsDir,
    sessionsDir: dirs.sessionsDir,
    memoryDb: dirs.memoryDb,
  };

  normalized.fallbackOrder = normalized.fallbackOrder.map((p) => normalizeProvider(p));
  normalized.fallbacks = normalized.fallbackOrder
    .filter((p) => p !== normalized.provider && ['ollama', 'nvidia', 'openrouter', 'openai'].includes(p))
    .map((p) => {
      const c = getProviderEnvConfig(normalized, p);
      return {
        provider: p,
        model: normalizeModel(p, normalized.providerModels?.[p], normalized.providerModels),
        baseUrl: c.baseUrl,
        apiKey: c.apiKey,
      };
    });

  return normalized;
}

export function loadConfig() {
  const dirs = ensureAppDirs();
  const fromFile = existsSync(dirs.configFile)
    ? JSON.parse(readFileSync(dirs.configFile, 'utf-8'))
    : {};
  const cfg = withDerived({ ...DEFAULTS, ...fromFile });
  writeFileSync(dirs.configFile, JSON.stringify(cfg, null, 2));
  return cfg;
}

export function saveConfig(partial) {
  const current = loadConfig();
  const merged = withDerived({ ...current, ...partial });
  writeFileSync(merged.configFile, JSON.stringify(merged, null, 2));
  return merged;
}

export function getConfig() {
  return loadConfig();
}
