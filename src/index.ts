import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { validateDependencies, exec, delay, log, setActionDelay, getActionDelay } from './utils.js';

const MAX_SCREENSHOT_WIDTH = 1920;
const JPEG_QUALITY = 80;

function tmpScreenshotPath(): string {
  return join(tmpdir(), `computer-use-mcp-${Date.now()}.png`);
}

async function optimizeScreenshot(filePath: string): Promise<{ data: string; mimeType: string }> {
  const img = sharp(filePath);
  const metadata = await img.metadata();

  let pipeline = img;
  if (metadata.width && metadata.width > MAX_SCREENSHOT_WIDTH) {
    pipeline = pipeline.resize(MAX_SCREENSHOT_WIDTH);
  }

  const buffer = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();

  await unlink(filePath).catch(() => {});

  return {
    data: buffer.toString('base64'),
    mimeType: 'image/jpeg',
  };
}

async function main(): Promise<void> {
  await validateDependencies();

  const server = new McpServer({
    name: 'computer-use',
    version: '1.0.0',
  });

  // 1. screenshot
  server.registerTool(
    'screenshot',
    {
      title: 'Screenshot',
      description:
        'Take a screenshot of the entire screen or a specific region. Returns the image as base64 JPEG.',
      inputSchema: {
        region: z
          .object({
            x: z.number().int().describe('X coordinate of the top-left corner'),
            y: z.number().int().describe('Y coordinate of the top-left corner'),
            width: z.number().int().positive().describe('Width of the region in pixels'),
            height: z.number().int().positive().describe('Height of the region in pixels'),
          })
          .optional()
          .describe('Optional region to capture. If omitted, captures the entire screen.'),
      },
    },
    async ({ region }) => {
      const filePath = tmpScreenshotPath();
      const args: string[] = [filePath, '--overwrite', '--silent'];

      if (region) {
        const geo = `${region.width}x${region.height}+${region.x}+${region.y}`;
        args.push('--select', '--autoselect');
        // scrot -a for area selection
        args.length = 0;
        args.push('-a', `${region.x},${region.y},${region.width},${region.height}`, filePath, '--overwrite', '--silent');
      }

      log('screenshot', { region, filePath });
      await exec('scrot', args);

      const { data, mimeType } = await optimizeScreenshot(filePath);
      return { content: [{ type: 'image' as const, data, mimeType }] };
    }
  );

  // 2. click
  server.registerTool(
    'click',
    {
      title: 'Click',
      description: 'Click at a specific screen position using xdotool.',
      inputSchema: {
        x: z.number().int().describe('X coordinate to click'),
        y: z.number().int().describe('Y coordinate to click'),
        button: z
          .enum(['left', 'right', 'middle'])
          .default('left')
          .describe('Mouse button to click'),
      },
    },
    async ({ x, y, button }) => {
      const buttonMap = { left: '1', right: '3', middle: '2' };
      log('click', { x, y, button });
      await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
      await exec('xdotool', ['click', buttonMap[button]]);
      await delay();
      return { content: [{ type: 'text' as const, text: `Clicked ${button} at (${x}, ${y})` }] };
    }
  );

  // 3. double_click
  server.registerTool(
    'double_click',
    {
      title: 'Double Click',
      description: 'Double-click at a specific screen position.',
      inputSchema: {
        x: z.number().int().describe('X coordinate to double-click'),
        y: z.number().int().describe('Y coordinate to double-click'),
      },
    },
    async ({ x, y }) => {
      log('double_click', { x, y });
      await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
      await exec('xdotool', ['click', '--repeat', '2', '--delay', '50', '1']);
      await delay();
      return { content: [{ type: 'text' as const, text: `Double-clicked at (${x}, ${y})` }] };
    }
  );

  // 4. type_text
  server.registerTool(
    'type_text',
    {
      title: 'Type Text',
      description: 'Type text at the current cursor position using xdotool.',
      inputSchema: {
        text: z.string().describe('Text to type'),
        delay_ms: z
          .number()
          .int()
          .min(0)
          .default(12)
          .describe('Delay between keystrokes in milliseconds'),
      },
    },
    async ({ text, delay_ms }) => {
      log('type_text', { text: text.slice(0, 50), delay_ms });
      await exec('xdotool', ['type', '--delay', String(delay_ms), '--clearmodifiers', text]);
      await delay();
      return { content: [{ type: 'text' as const, text: `Typed ${text.length} characters` }] };
    }
  );

  // 5. key_press
  server.registerTool(
    'key_press',
    {
      title: 'Key Press',
      description:
        'Press a key combination using xdotool. Examples: "ctrl+c", "alt+tab", "Return", "super".',
      inputSchema: {
        keys: z
          .string()
          .describe(
            'Key combination to press. Use "+" for combos (e.g. "ctrl+shift+t"). Key names follow xdotool conventions: Return, Tab, Escape, BackSpace, Delete, Home, End, Page_Up, Page_Down, Up, Down, Left, Right, super, ctrl, alt, shift.'
          ),
      },
    },
    async ({ keys }) => {
      log('key_press', { keys });
      await exec('xdotool', ['key', '--clearmodifiers', keys]);
      await delay();
      return { content: [{ type: 'text' as const, text: `Pressed: ${keys}` }] };
    }
  );

  // 6. mouse_move
  server.registerTool(
    'mouse_move',
    {
      title: 'Mouse Move',
      description: 'Move the mouse cursor to a position without clicking.',
      inputSchema: {
        x: z.number().int().describe('X coordinate to move to'),
        y: z.number().int().describe('Y coordinate to move to'),
      },
    },
    async ({ x, y }) => {
      log('mouse_move', { x, y });
      await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
      return { content: [{ type: 'text' as const, text: `Moved cursor to (${x}, ${y})` }] };
    }
  );

  // 7. scroll
  server.registerTool(
    'scroll',
    {
      title: 'Scroll',
      description: 'Scroll the mouse wheel at a specific position.',
      inputSchema: {
        x: z.number().int().describe('X coordinate to scroll at'),
        y: z.number().int().describe('Y coordinate to scroll at'),
        direction: z.enum(['up', 'down']).describe('Scroll direction'),
        clicks: z.number().int().positive().default(3).describe('Number of scroll clicks'),
      },
    },
    async ({ x, y, direction, clicks }) => {
      log('scroll', { x, y, direction, clicks });
      await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);

      const button = direction === 'up' ? '4' : '5';
      await exec('xdotool', ['click', '--repeat', String(clicks), '--delay', '50', button]);
      await delay();
      return {
        content: [{ type: 'text' as const, text: `Scrolled ${direction} ${clicks}x at (${x}, ${y})` }],
      };
    }
  );

  // 8. drag
  server.registerTool(
    'drag',
    {
      title: 'Drag',
      description: 'Drag from one position to another (drag and drop).',
      inputSchema: {
        from_x: z.number().int().describe('Starting X coordinate'),
        from_y: z.number().int().describe('Starting Y coordinate'),
        to_x: z.number().int().describe('Ending X coordinate'),
        to_y: z.number().int().describe('Ending Y coordinate'),
      },
    },
    async ({ from_x, from_y, to_x, to_y }) => {
      log('drag', { from_x, from_y, to_x, to_y });
      await exec('xdotool', ['mousemove', '--sync', String(from_x), String(from_y)]);
      await exec('xdotool', ['mousedown', '1']);
      await exec('xdotool', ['mousemove', '--sync', String(to_x), String(to_y)]);
      await exec('xdotool', ['mouseup', '1']);
      await delay();
      return {
        content: [
          { type: 'text' as const, text: `Dragged from (${from_x}, ${from_y}) to (${to_x}, ${to_y})` },
        ],
      };
    }
  );

  // 9. get_screen_size
  server.registerTool(
    'get_screen_size',
    {
      title: 'Get Screen Size',
      description: 'Get the current screen resolution using xrandr.',
      inputSchema: {},
    },
    async () => {
      log('get_screen_size');
      const { stdout } = await exec('xrandr', ['--current']);
      const match = stdout.match(/current\s+(\d+)\s*x\s*(\d+)/);

      if (!match) {
        return { content: [{ type: 'text' as const, text: 'Could not determine screen size' }], isError: true };
      }

      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ width, height }) }],
      };
    }
  );

  // 10. get_cursor_position
  server.registerTool(
    'get_cursor_position',
    {
      title: 'Get Cursor Position',
      description: 'Get the current mouse cursor position.',
      inputSchema: {},
    },
    async () => {
      log('get_cursor_position');
      const { stdout } = await exec('xdotool', ['getmouselocation']);
      const xMatch = stdout.match(/x:(\d+)/);
      const yMatch = stdout.match(/y:(\d+)/);

      const x = xMatch ? parseInt(xMatch[1], 10) : 0;
      const y = yMatch ? parseInt(yMatch[1], 10) : 0;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ x, y }) }],
      };
    }
  );

  // 11. wait
  server.registerTool(
    'wait',
    {
      title: 'Wait',
      description: 'Wait for a specified duration. Useful for waiting between actions.',
      inputSchema: {
        ms: z.number().int().positive().max(30_000).describe('Milliseconds to wait (max 30000)'),
      },
    },
    async ({ ms }) => {
      log('wait', { ms });
      await delay(ms);
      return { content: [{ type: 'text' as const, text: `Waited ${ms}ms` }] };
    }
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('server_started', { version: '1.0.0' });
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
