import { exec } from 'child_process';
import { promisify } from 'util';
import { toWorkspacePath } from '../core/paths.js';

const execAsync = promisify(exec);

function denyDangerous(command) {
  const blocked = [/\brm\s+-rf\s+\/$/, /:\s*\(\)\s*\{/, /\bmkfs\b/, /\bdd\s+if=.*of=\/dev\//];
  if (blocked.some((r) => r.test(command))) {
    throw new Error('Blocked destructive command pattern');
  }
}

export async function execute(args, config) {
  const { command, cwd, timeout = 60000 } = args;

  try {
    denyDangerous(command);
    const safeCwd = toWorkspacePath(cwd || '.', config.workspaceRoot);
    const { stdout, stderr } = await execAsync(command, {
      cwd: safeCwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash',
    });
    return { success: true, stdout, stderr, exitCode: 0 };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      exitCode: e.code,
    };
  }
}
