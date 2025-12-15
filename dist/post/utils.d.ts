import * as exec from '@actions/exec';
/**
 * Execute a command with retry logic for transient failures.
 * Shared utility used by micropython setup and toolchain commands.
 */
export declare function execWithRetry(command: string, args: string[], options?: exec.ExecOptions, maxRetries?: number, delayMs?: number): Promise<number>;
/**
 * Parallel execution with concurrency limit using a worker pool pattern.
 * Uses a queue with synchronous shift() to avoid race conditions.
 * Exported for testing.
 */
export declare function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]>;
