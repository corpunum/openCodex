/**
 * File Operations Tool
 * Auto-approved: read, write, create, delete files
 */

import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

export async function execute(args) {
  const { action, path, content, recursive = true } = args;
  
  try {
    switch (action) {
      case 'read':
        return await readFile(path, 'utf-8');
      
      case 'write':
        await mkdir(dirname(path), { recursive });
        await writeFile(path, content, 'utf-8');
        return { success: true, path };
      
      case 'create':
        await mkdir(dirname(path), { recursive });
        await writeFile(path, content || '', 'utf-8');
        return { success: true, path };
      
      case 'delete':
        if (existsSync(path)) {
          await rm(path, { recursive: true, force: true });
          return { success: true, deleted: path };
        }
        return { success: false, error: 'File not found' };
      
      case 'list':
        const files = await readdir(path);
        return { files };
      
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
