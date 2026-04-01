export function getCapabilities(config) {
  return {
    contract_version: '2026-04-01.webui-capabilities.v1',
    app_id: 'opencodex',
    app_name: 'openCodex',
    menu: ['chat', 'missions', 'trace', 'runtime', 'settings'],
    quick_prompts: [
      'Perform a code-level risk review and list concrete regression points.',
      'Generate a surgical fix and include the exact verification commands.',
      'Run a mission that validates fallback provider resilience.',
      'Summarize workspace-impacting changes and propose rollout order.',
    ],
    features: {
      chat: true,
      sessions: true,
      missions: true,
      trace: true,
      model_catalog: true,
      provider_health: true,
      self_heal: true,
      browser_control: true,
      git_runtime: true,
      workspace_guardrails: true,
      code_focus: true,
      memory_inspection: false,
      research: false,
    },
    ui: {
      shell: 'shared-autonomy-v1',
      chat_style: 'imessage',
      skin: 'codex-grid',
    },
    runtime: {
      host: config.host,
      port: config.port,
      home: config.home,
      workspace_root: config.workspaceRoot,
    },
  };
}
