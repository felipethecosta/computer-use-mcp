import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function exec(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command, args, { timeout: 10_000 });
}

let actionDelay = 100;

export function setActionDelay(ms: number): void {
  actionDelay = ms;
}

export function getActionDelay(): number {
  return actionDelay;
}

export async function delay(ms?: number): Promise<void> {
  const wait = ms ?? actionDelay;
  if (wait > 0) {
    return new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export function log(action: string, details?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}
