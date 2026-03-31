# computer-use-mcp

MCP server for computer use automation. Provides screenshot, click, keyboard, mouse, and drag-and-drop tools. Supports **Linux** (X11) and **Windows** (10/11).

## System Dependencies

### Linux

```bash
sudo apt install xdotool scrot x11-xserver-utils
```

- **xdotool** — mouse/keyboard automation
- **scrot** — screenshots
- **xrandr** (from x11-xserver-utils) — screen resolution

### Windows

No external dependencies required. Uses built-in PowerShell with .NET Framework:

- **PowerShell** — comes pre-installed on Windows 10/11
- **user32.dll** — native mouse/keyboard input via SendInput P/Invoke
- **System.Drawing** — screenshot capture
- **System.Windows.Forms** — screen resolution detection

Requirements:
- Windows 10 or 11
- .NET Framework (pre-installed)
- Desktop session must be active (screen unlocked)

## Setup

```bash
pnpm install
pnpm build
```

## Usage

### With Claude Code

Add to `~/.claude/settings.json` (Linux) or `%USERPROFILE%\.claude\settings.json` (Windows):

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "node",
      "args": ["/path/to/computer-use-mcp/dist/index.js"]
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

## Platform Details

### Linux
- Uses xdotool for mouse/keyboard, scrot for screenshots, xrandr for screen info
- Requires X11 display (Wayland not supported)

### Windows
- Uses PowerShell with inline C# (Add-Type) calling user32.dll SendInput
- ~200-500ms overhead per operation due to PowerShell startup and Add-Type compilation
- Captures primary monitor only
- `typeText` uses KEYEVENTF_UNICODE for full Unicode support
- `delay_ms` parameter on `type_text` is ignored (SendInput sends all chars at once)
- DPI-aware: calls SetProcessDPIAware before coordinate/screenshot operations

## Notes

- Screenshots are automatically resized if wider than 1920px and compressed to JPEG quality 80
- A 100ms delay is applied after each action to avoid race conditions
- All actions are logged to stderr in JSON format
- Platform is auto-detected at startup via `process.platform`
