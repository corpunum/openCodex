/**
 * Shell Command Tool
 * Auto-approved: executes shell commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execute(args) {
  const { command, cwd = process.cwd(), timeout = 60000 } = args;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024
    });
    
    return {
      success: true,
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      exitCode: e.code
    };
  }
}
