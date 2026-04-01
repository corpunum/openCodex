import { mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

export function getAppHome() {
  return process.env.OPENCODEX_HOME || join(os.homedir(), '.opencodex');
}

export function ensureAppDirs() {
  const home = getAppHome();
  const dirs = {
    home,
    dataDir: join(home, 'data'),
    logsDir: join(home, 'logs'),
    sessionsDir: join(home, 'data', 'sessions'),
    memoryDb: join(home, 'data', 'memory.db'),
    configFile: join(home, 'config.json'),
  };

  mkdirSync(dirs.dataDir, { recursive: true });
  mkdirSync(dirs.logsDir, { recursive: true });
  mkdirSync(dirs.sessionsDir, { recursive: true });
  return dirs;
}

export function getRepoRoot() {
  return REPO_ROOT;
}

export function toWorkspacePath(input, workspaceRoot = REPO_ROOT) {
  const base = resolve(workspaceRoot);
  const target = resolve(base, input || '.');
  if (target !== base && !target.startsWith(`${base}/`)) {
    throw new Error(`Path outside workspace denied: ${input}`);
  }
  return target;
}
