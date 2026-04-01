# Operations Runbook

## Start
`npm start`

Default bind: `127.0.0.1:18882`

## Service
`./scripts/install-systemd.sh`

## Tests
- `npm test`
- `npm run e2e`

## Runtime State
- `~/.opencodex/config.json`
- `~/.opencodex/data/*`
- `~/.opencodex/logs/*`

## Health Checks
- `curl -sS http://127.0.0.1:18882/api/health`
- `curl -sS http://127.0.0.1:18882/api/model-catalog`
- `curl -sS http://127.0.0.1:18882/api/capabilities`
