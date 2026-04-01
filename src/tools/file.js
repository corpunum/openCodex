import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { toWorkspacePath } from '../core/paths.js';

export async function execute(args, config) {
  const { action, path, content, recursive = true } = args;
  const target = toWorkspacePath(path, config.workspaceRoot);

  try {
    switch (action) {
      case 'read':
        return await readFile(target, 'utf-8');
      case 'write':
        await mkdir(dirname(target), { recursive });
        await writeFile(target, content ?? '', 'utf-8');
        return { success: true, path: target };
      case 'create':
        await mkdir(dirname(target), { recursive });
        await writeFile(target, content || '', 'utf-8');
        return { success: true, path: target };
      case 'delete':
        if (existsSync(target)) {
          await rm(target, { recursive: true, force: true });
          return { success: true, deleted: target };
        }
        return { success: false, error: 'File not found' };
      case 'list':
        const files = await readdir(target);
        return { files };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
