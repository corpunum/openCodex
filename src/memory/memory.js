import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export class MemoryManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'other',
        importance REAL DEFAULT 0.7,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content);
    `);
  }

  store(text, category = 'other', importance = 0.7) {
    const stmt = this.db.prepare('INSERT INTO memories (content, category, importance) VALUES (?, ?, ?)');
    const result = stmt.run(text, category, importance);
    this.db.prepare('INSERT INTO memories_fts (rowid, content) VALUES (?, ?)').run(result.lastInsertRowid, text);
    return { id: result.lastInsertRowid };
  }

  search(query, limit = 5) {
    const stmt = this.db.prepare(`
      SELECT m.*
      FROM memories m
      JOIN memories_fts f ON m.id = f.rowid
      WHERE f.content MATCH ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);
    return stmt.all(query, limit);
  }

  close() {
    if (this.db) this.db.close();
  }
}
