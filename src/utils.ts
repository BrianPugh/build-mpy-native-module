import * as exec from '@actions/exec';
import * as core from '@actions/core';

/**
 * Execute a command with retry logic for transient failures.
 * Shared utility used by micropython setup and toolchain commands.
 */
export async function execWithRetry(
  command: string,
  args: string[],
  options: exec.ExecOptions = {},
  maxRetries: number = 2,
  delayMs: number = 5000
): Promise<number> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const exitCode = await exec.exec(command, args, { ...options, ignoreReturnCode: true });
      if (exitCode !== 0) {
        throw new Error(`Command failed with exit code ${exitCode}`);
      }
      return exitCode;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt);
        core.warning(
          `Command failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitTime}ms: ${command} ${args.join(' ')}`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Parallel execution with concurrency limit using a worker pool pattern.
 * Uses a queue with synchronous shift() to avoid race conditions.
 * Exported for testing.
 */
export async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  // Create queue of indices - shift() is synchronous and safe
  const queue: number[] = items.map((_, i) => i);

  async function worker(): Promise<void> {
    while (true) {
      const index = queue.shift();
      if (index === undefined) break;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
