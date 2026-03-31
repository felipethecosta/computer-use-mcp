# computer-use-mcp

MCP server for computer use automation (screenshots, mouse, keyboard). Supports Linux (X11) and Windows (10/11).

## Stack

- TypeScript, Node.js (ESM)
- @modelcontextprotocol/sdk (stdio transport)
- sharp (image optimization)
- Linux deps: xdotool, scrot, xrandr
- Windows deps: none (PowerShell + .NET built-in)

## Structure

```
src/
  index.ts              — MCP server setup, all 11 tool registrations
  utils.ts              — exec wrapper, delay, logging
  which.ts              — cross-platform PATH lookup for binary existence check
  platform/
    types.ts            — PlatformProvider interface
    detect.ts           — auto-detect OS, return correct provider
    linux.ts            — LinuxProvider (xdotool, scrot, xrandr)
    windows.ts          — WindowsProvider (PowerShell + user32.dll + System.Drawing)
    windows-keys.ts     — xdotool key names → Windows VK codes mapping
```

## Build & Run

```bash
pnpm install && pnpm build
node dist/index.js          # production (stdio)
pnpm dev                    # development with tsx
```

## Key Patterns

- Platform abstraction: `PlatformProvider` interface with Linux/Windows implementations
- `detectPlatform()` runs at startup, selects provider based on `process.platform`
- Tools use `exec()` wrapper around `execFile` (no shell, safe from injection)
- Screenshots go through sharp: resize to max 1920px width, JPEG quality 80
- All tools log to stderr (JSON format) — stdout is reserved for MCP protocol
- 100ms default delay after mouse/keyboard actions to prevent race conditions
- Provider `validateDependencies()` runs at startup, fails fast if deps missing

## Constraints

- Linux: X11 only (xdotool does not work on Wayland)
- Linux: scrot `-a` flag for region capture
- Windows: ~200-500ms overhead per operation (PowerShell + Add-Type)
- Windows: SendInput requires active desktop (screen unlocked)
- Windows: captures primary monitor only
- Max wait time: 30 seconds
- exec timeout: 10 seconds per command
