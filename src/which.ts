import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

export async function which(bin: string): Promise<string | null> {
  const dirs = (process.env.PATH ?? '').split(':');

  for (const dir of dirs) {
    const fullPath = join(dir, bin);
    try {
      await access(fullPath, constants.X_OK);
      return fullPath;
    } catch {
      continue;
    }
  }

  return null;
}
