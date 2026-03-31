/**
 * Memory Manager - SQLite + BM25 for long-term memory
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export class MemoryManager {
  constructor(dbPath = './data/memory.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    
    // Create tables
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
    
    console.log('[Memory] Initialized at', this.dbPath);
  }

  store(text, category = 'other', importance = 0.7) {
    const stmt = this.db.prepare('INSERT INTO memories (content, category, importance) VALUES (?, ?, ?)');
    const result = stmt.run(text, category, importance);
    
    // Also index for full-text search
    this.db.prepare('INSERT INTO memories_fts (rowid, content) VALUES (?, ?)').run(result.lastInsertRowid, text);
    
    return { id: result.lastInsertRowid };
  }

  search(query, limit = 5) {
    const stmt = this.db.prepare(`
      SELECT m.*, fts.rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `);
    return stmt.all(query, limit);
  }

  list(limit = 10) {
    const stmt = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
