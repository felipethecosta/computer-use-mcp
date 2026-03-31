import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { delay, log } from './utils.js';
import { detectPlatform } from './platform/detect.js';

const MAX_SCREENSHOT_WIDTH = 1920;
const JPEG_QUALITY = 80;

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
  const platform = detectPlatform();
  await platform.validateDependencies();

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
      log('screenshot', { region });
      const { filePath } = await platform.screenshot(region);
      const { data, mimeType } = await optimizeScreenshot(filePath);
      return { content: [{ type: 'image' as const, data, mimeType }] };
    }
  );

  // 2. click
  server.registerTool(
    'click',
    {
      title: 'Click',
      description: 'Click at a specific screen position.',
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
      log('click', { x, y, button });
      await platform.click(x, y, button);
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
      await platform.doubleClick(x, y);
      await delay();
      return { content: [{ type: 'text' as const, text: `Double-clicked at (${x}, ${y})` }] };
    }
  );

  // 4. type_text
  server.registerTool(
    'type_text',
    {
      title: 'Type Text',
      description: 'Type text at the current cursor position.',
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
      await platform.typeText(text, delay_ms);
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
        'Press a key combination. Examples: "ctrl+c", "alt+tab", "Return", "super".',
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
      await platform.keyPress(keys);
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
      await platform.mouseMove(x, y);
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
      await platform.scroll(x, y, direction, clicks);
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
      await platform.drag(from_x, from_y, to_x, to_y);
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
      description: 'Get the current screen resolution.',
      inputSchema: {},
    },
    async () => {
      log('get_screen_size');
      try {
        const size = await platform.getScreenSize();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(size) }],
        };
      } catch {
        return { content: [{ type: 'text' as const, text: 'Could not determine screen size' }], isError: true };
      }
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
      const pos = await platform.getCursorPosition();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(pos) }],
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
