# openCodex

Autonomous coding assistant with web UI - no approvals required.

## Features

- **Auto-approve mode**: Executes tasks immediately without user confirmation
- **Persistent sessions**: Chat history saved to JSON files
- **Web UI**: Clean interface with sidebar session list
- **Tools**: File ops, shell, git, browser automation
- **Cloud models**: Primary qwen3.5:397b-cloud with fallbacks

## Quick Start

```bash
npm install
npm start
```

Open http://127.0.0.1:18882

## API

- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/chat` - Send message (body: `{ message, sessionId }`)
- `GET /api/health` - Health check

## Architecture

```
src/
  core/
    agent.js - Autonomous agent loop
    session-manager.js - Session persistence
    config.js - Configuration
  tools/
    file.js - File operations
    shell.js - Shell commands
    git.js - Git operations
    browser.js - Browser automation
  ui/
    server.js - HTTP + WebSocket server
    public/index.html - Web UI
  memory/
    memory.js - SQLite + BM25
  health/
    circuit-breaker.js - Provider health
```

## License

MIT
