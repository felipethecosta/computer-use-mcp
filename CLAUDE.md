# computer-use-mcp

MCP server for Linux computer use automation (screenshots, mouse, keyboard).

## Stack

- TypeScript, Node.js (ESM)
- @modelcontextprotocol/sdk (stdio transport)
- sharp (image optimization)
- System deps: xdotool, scrot, xrandr

## Structure

```
src/
  index.ts    — MCP server setup, all 11 tool registrations
  utils.ts    — exec wrapper, delay, logging, dependency validation
  which.ts    — PATH lookup for binary existence check
```

## Build & Run

```bash
pnpm install && pnpm build
node dist/index.js          # production (stdio)
pnpm dev                    # development with tsx
```

## Key Patterns

- Tools use `exec()` wrapper around `execFile` (no shell, safe from injection)
- Screenshots go through sharp: resize to max 1920px width, JPEG quality 80
- All tools log to stderr (JSON format) — stdout is reserved for MCP protocol
- 100ms default delay after mouse/keyboard actions to prevent race conditions
- `validateDependencies()` runs at startup, fails fast if xdotool/scrot/xrandr missing

## Constraints

- X11 only (xdotool does not work on Wayland)
- scrot `-a` flag for region capture
- Max wait time: 30 seconds
- exec timeout: 10 seconds per command
