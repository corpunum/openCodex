# Changelog

## Unreleased
- Added isolated runtime home and state directories (`~/.opencodex`).
- Added multi-provider configuration for Ollama/OpenRouter/NVIDIA/OpenAI.
- Added workspace-scoped file/shell/git execution paths.
- Added deploy assets and WebUI chat E2E test.
- Added docs baseline files: `INDEX.md`, `CODEBASE_MAP.md`, and `AUTONOMY_AND_MEMORY.md`.
- Added canonical model catalog endpoint and ranking contract:
  - `GET /api/model-catalog`
  - provider order fixed to `ollama,nvidia,openrouter,openai`
- Added capability contract endpoint:
  - `GET /api/capabilities`
- Added config and compatibility endpoints:
  - `GET /api/config`
  - `POST /api/config`
  - `GET /api/models?provider=...` compatibility adapter
- Added mission and event API surfaces:
  - `GET /api/events`
  - `GET /api/missions`
  - `POST /api/missions/start`
  - `GET /api/missions/status`
  - `POST /api/missions/stop`
- Reworked WebUI into shared shell layout with standardized selectors for provider/model routing, health, trace, and status bar.
- Added new acceptance tests:
  - `tests/e2e/model-catalog.e2e.js`
  - `tests/e2e/webui-contract.e2e.js`
