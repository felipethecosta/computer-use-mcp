import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const PATH_SEP = isWindows ? ';' : ':';
const PATHEXT = isWindows
  ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
  : [];

export async function which(bin: string): Promise<string | null> {
  const dirs = (process.env.PATH ?? '').split(PATH_SEP);

  for (const dir of dirs) {
    if (isWindows) {
      // On Windows, check with each PATHEXT extension
      for (const ext of PATHEXT) {
        const fullPath = join(dir, bin + ext);
        try {
          await access(fullPath, constants.R_OK);
          return fullPath;
        } catch {
          continue;
        }
      }
      // Also try the bare name (might already have extension)
      const fullPath = join(dir, bin);
      try {
        await access(fullPath, constants.R_OK);
        return fullPath;
      } catch {
        continue;
      }
    } else {
      const fullPath = join(dir, bin);
      try {
        await access(fullPath, constants.X_OK);
        return fullPath;
      } catch {
        continue;
      }
    }
  }

  return null;
}
