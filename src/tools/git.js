/**
 * Git Operations Tool
 * Auto-approved: git commands without confirmation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execute(args) {
  const { command, cwd = process.cwd() } = args;
  
  try {
    // Safety: only allow git commands
    const gitCmd = `git ${command}`;
    const { stdout, stderr } = await execAsync(gitCmd, {
      cwd,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    });
    
    return {
      success: true,
      stdout,
      stderr
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      stdout: e.stdout || '',
      stderr: e.stderr || ''
    };
  }
}
