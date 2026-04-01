import { Agent } from './core/agent.js';
import { UIServer } from './ui/server.js';
import { loadConfig } from './core/config.js';

async function main() {
  const config = loadConfig();
  console.log('[openCodex] Starting...');
  console.log('[openCodex] Home:', config.home);

  const agent = new Agent();
  await agent.initialize();

  const server = new UIServer(agent, config.port, config.host);
  await server.start();

  console.log(`[openCodex] Ready at http://${config.host}:${config.port}`);
}

main().catch((e) => {
  console.error('[openCodex] Fatal:', e);
  process.exit(1);
});
