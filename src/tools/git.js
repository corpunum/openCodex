import { exec } from 'child_process';
import { promisify } from 'util';
import { toWorkspacePath } from '../core/paths.js';

const execAsync = promisify(exec);

export async function execute(args, config) {
  const { command, cwd } = args;
  if (!command || /[;&|`]/.test(command)) {
    return { success: false, error: 'Invalid git command' };
  }

  try {
    const safeCwd = toWorkspacePath(cwd || '.', config.workspaceRoot);
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd: safeCwd,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, stdout, stderr };
  } catch (e) {
    return { success: false, error: e.message, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}
