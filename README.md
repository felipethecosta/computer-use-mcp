# computer-use-mcp

MCP server for computer use on Linux. Provides screenshot, click, keyboard, mouse, and drag-and-drop tools via xdotool and scrot.

## System Dependencies

```bash
sudo apt install xdotool scrot x11-xserver-utils
```

- **xdotool** — mouse/keyboard automation
- **scrot** — screenshots
- **xrandr** (from x11-xserver-utils) — screen resolution

## Setup

```bash
pnpm install
pnpm build
```

## Usage

### With Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "node",
      "args": ["/home/<user>/dev/heartbread/computer-use-mcp/dist/index.js"]
    }
  }
}
```

### Development

```bash
pnpm dev
```

## Tools

| Tool | Description |
|------|-------------|
| `screenshot` | Capture full screen or a region. Returns optimized JPEG base64. |
| `click` | Click at (x, y) with left/right/middle button. |
| `double_click` | Double-click at (x, y). |
| `type_text` | Type text at current cursor position. |
| `key_press` | Press key combinations (e.g. `ctrl+c`, `alt+tab`). |
| `mouse_move` | Move cursor without clicking. |
| `scroll` | Scroll up/down at a position. |
| `drag` | Drag and drop from one position to another. |
| `get_screen_size` | Get screen resolution. |
| `get_cursor_position` | Get current cursor position. |
| `wait` | Wait N milliseconds between actions. |

## Notes

- Screenshots are automatically resized if wider than 1920px and compressed to JPEG quality 80
- A 100ms delay is applied after each action to avoid race conditions
- All actions are logged to stderr for debugging
- Requires an X11 display (Wayland not supported)
