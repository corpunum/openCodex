import { loadConfig } from '../src/core/config.js';
import { Agent } from '../src/core/agent.js';

async function main() {
  const config = loadConfig();
  const agent = new Agent();
  await agent.initialize();

  if (!config.home || !config.sessionsDir || !config.memoryDb) {
    throw new Error('config paths missing');
  }

  console.log('config.home:', config.home);
  console.log('provider:', config.provider, 'model:', config.model);
  console.log('PASS');
  agent.memory.close();
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
