# Autonomy and Memory

openCodex is designed for autonomous execution with low manual friction.

## Memory
- Runtime state is isolated under `~/.opencodex`.
- Session and memory persistence are kept outside source-controlled files.

## Execution
- Agent loop supports direct tool usage and WebUI chat workflows.
- Health/circuit-breaker behavior limits cascading tool/provider failures.
