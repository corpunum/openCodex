# openCodex

Autonomous coding assistant with Web UI.

## Runtime Isolation
- App home: `~/.opencodex`
- Config: `~/.opencodex/config.json`
- Sessions: `~/.opencodex/data/sessions`
- Memory DB: `~/.opencodex/data/memory.db`

## Providers
- Ollama local/cloud
- OpenRouter
- NVIDIA NIM
- OpenAI

## Start
```bash
npm install
npm start
```
UI: `http://127.0.0.1:18882`

## Test
```bash
npm test
npm run e2e:webui
```
