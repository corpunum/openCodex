# API Reference

- `GET /api/health`
- `GET /api/capabilities`
- `GET /api/model-catalog`
- `GET /api/models?provider=<provider>` (compat)
- `GET /api/config`
- `POST /api/config`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `POST /api/chat` with `{ message, sessionId }`
- `GET /api/events?prefix=<optional>&limit=<n>`
- `GET /api/missions`
- `POST /api/missions/start` with `{ goal, maxSteps?, continueUntilDone?, intervalMs? }`
- `GET /api/missions/status?id=<missionId>`
- `POST /api/missions/stop` with `{ id }`

## Contracts

- Model catalog contract version: `2026-04-01.model-catalog.v1`
- Capabilities contract version: `2026-04-01.webui-capabilities.v1`
- Provider order: `ollama`, `nvidia`, `openrouter`, `openai`

## WebUI Contract

The shared WebUI shell exposes these required selectors:

- `data-testid="new-session"`
- `data-testid="session-search"`
- `data-testid="message-stream"`
- `data-testid="composer-input"`
- `data-testid="send-message"`
- `data-testid="provider-select"`
- `data-testid="model-select"`
- `data-testid="fallback-model-select"`
- `data-testid="autonomy-mode-select"`
- `data-testid="provider-health"`
- `data-testid="trace-panel"`
- `data-testid="status-bar"`
