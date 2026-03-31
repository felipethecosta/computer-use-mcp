import type { PlatformProvider } from './types.js';
import { LinuxProvider } from './linux.js';
import { WindowsProvider } from './windows.js';
import { log } from '../utils.js';

export function detectPlatform(): PlatformProvider {
  const platform = process.platform;

  if (platform === 'win32') {
    log('platform_detected', { platform: 'windows' });
    return new WindowsProvider();
  }

  if (platform === 'linux') {
    log('platform_detected', { platform: 'linux' });
    return new LinuxProvider();
  }

  throw new Error(`Unsupported platform: ${platform}. Only Linux and Windows are supported.`);
}
