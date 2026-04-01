import { mkdir, readdir, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export class SessionManager {
  constructor(sessionsDir) {
    this.sessionsDir = sessionsDir;
  }

  async initialize() {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async create(title = 'New Chat') {
    const id = this.generateId();
    const session = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      messageCount: 0,
    };
    await this.save(session);
    return session;
  }

  async save(session) {
    session.updatedAt = new Date().toISOString();
    const path = join(this.sessionsDir, `${session.id}.json`);
    await writeFile(path, JSON.stringify(session, null, 2));
  }

  async load(id) {
    const path = join(this.sessionsDir, `${id}.json`);
    if (!existsSync(path)) return null;
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  async list() {
    if (!existsSync(this.sessionsDir)) return [];
    const files = await readdir(this.sessionsDir);
    const sessions = [];
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      try {
        const content = await readFile(join(this.sessionsDir, file), 'utf-8');
        const session = JSON.parse(content);
        sessions.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messageCount,
        });
      } catch {
      }
    }
    return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async delete(id) {
    const path = join(this.sessionsDir, `${id}.json`);
    if (existsSync(path)) {
      await rm(path);
      return true;
    }
    return false;
  }

  async addMessage(sessionId, message) {
    const session = await this.load(sessionId);
    if (!session) return null;

    session.messages.push(message);
    session.messageCount = session.messages.length;

    if (session.messageCount === 1 && message.role === 'user') {
      session.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    await this.save(session);
    return session;
  }
}
