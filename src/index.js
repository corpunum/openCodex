/**
 * openCodex - Autonomous Coding Assistant
 * Entry point - starts agent and UI server
 */

import { Agent } from './core/agent.js';
import { UIServer } from './ui/server.js';

async function main() {
  console.log('[openCodex] Starting...');
  
  // Initialize agent
  const agent = new Agent();
  await agent.initialize();
  
  // Start UI server
  const server = new UIServer(agent, 18882);
  await server.start();
  
  console.log('[openCodex] Ready at http://127.0.0.1:18882');
}

main().catch(console.error);
