import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { which } from '../which.js';
import { exec } from '../utils.js';
import type {
  PlatformProvider,
  ScreenRegion,
  ScreenSize,
  CursorPosition,
  ScreenshotResult,
  MouseButton,
  ScrollDirection,
} from './types.js';

const REQUIRED_BINARIES = ['xdotool', 'scrot', 'xrandr'] as const;

function tmpScreenshotPath(): string {
  return join(tmpdir(), `computer-use-mcp-${Date.now()}.png`);
}

export class LinuxProvider implements PlatformProvider {
  async validateDependencies(): Promise<void> {
    const missing: string[] = [];

    for (const bin of REQUIRED_BINARIES) {
      const found = await which(bin);
      if (!found) missing.push(bin);
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing system dependencies: ${missing.join(', ')}. Install with: sudo apt install ${missing.join(' ')}`
      );
    }
  }

  async screenshot(region?: ScreenRegion): Promise<ScreenshotResult> {
    const filePath = tmpScreenshotPath();

    if (region) {
      await exec('scrot', [
        '-a', `${region.x},${region.y},${region.width},${region.height}`,
        filePath, '--overwrite', '--silent',
      ]);
    } else {
      await exec('scrot', [filePath, '--overwrite', '--silent']);
    }

    return { filePath };
  }

  async click(x: number, y: number, button: MouseButton): Promise<void> {
    const buttonMap: Record<MouseButton, string> = { left: '1', right: '3', middle: '2' };
    await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
    await exec('xdotool', ['click', buttonMap[button]]);
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
    await exec('xdotool', ['click', '--repeat', '2', '--delay', '50', '1']);
  }

  async typeText(text: string, delayMs: number): Promise<void> {
    await exec('xdotool', ['type', '--delay', String(delayMs), '--clearmodifiers', text]);
  }

  async keyPress(keys: string): Promise<void> {
    await exec('xdotool', ['key', '--clearmodifiers', keys]);
  }

  async mouseMove(x: number, y: number): Promise<void> {
    await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
  }

  async scroll(x: number, y: number, direction: ScrollDirection, clicks: number): Promise<void> {
    await exec('xdotool', ['mousemove', '--sync', String(x), String(y)]);
    const button = direction === 'up' ? '4' : '5';
    await exec('xdotool', ['click', '--repeat', String(clicks), '--delay', '50', button]);
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await exec('xdotool', ['mousemove', '--sync', String(fromX), String(fromY)]);
    await exec('xdotool', ['mousedown', '1']);
    await exec('xdotool', ['mousemove', '--sync', String(toX), String(toY)]);
    await exec('xdotool', ['mouseup', '1']);
  }

  async getScreenSize(): Promise<ScreenSize> {
    const { stdout } = await exec('xrandr', ['--current']);
    const match = stdout.match(/current\s+(\d+)\s*x\s*(\d+)/);

    if (!match) {
      throw new Error('Could not determine screen size from xrandr output');
    }

    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }

  async getCursorPosition(): Promise<CursorPosition> {
    const { stdout } = await exec('xdotool', ['getmouselocation']);
    const xMatch = stdout.match(/x:(\d+)/);
    const yMatch = stdout.match(/y:(\d+)/);

    return {
      x: xMatch ? parseInt(xMatch[1], 10) : 0,
      y: yMatch ? parseInt(yMatch[1], 10) : 0,
    };
  }
}
