import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { spawn } from 'child_process';
import { Architecture, Toolchain, ToolchainCacheConfig } from '../types';

export interface ExecOptionsWithTimeout extends exec.ExecOptions {
  /** Timeout in milliseconds. If specified, the command will be aborted after this time. */
  timeout?: number;
}

export abstract class BaseToolchain implements Toolchain {
  abstract readonly name: string;
  abstract readonly architecture: Architecture;

  abstract setup(): Promise<void>;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getCacheConfig(): ToolchainCacheConfig {
    return {
      architecture: this.architecture,
      cachePaths: [],
      cacheKey: '',
      restoreKeys: [],
    };
  }

  getPathAdditions(): string[] {
    return [];
  }

  getEnvironment(): Record<string, string> {
    return {};
  }

  /**
   * Execute a command with error handling and optional timeout.
   * When timeout is specified, the process is properly killed on timeout.
   * @param command - The command to execute
   * @param args - Command arguments
   * @param options - Execution options (including optional timeout)
   * @param ignoreErrors - If true, don't throw on non-zero exit code
   */
  protected async execCommand(
    command: string,
    args: string[] = [],
    options: ExecOptionsWithTimeout = {},
    ignoreErrors: boolean = false
  ): Promise<number> {
    core.info(`Running: ${command} ${args.join(' ')}`);

    const { timeout, ...execOptions } = options;

    // If timeout is specified, use spawn directly so we can kill the process
    if (timeout && timeout > 0) {
      return this.execCommandWithKillableTimeout(command, args, execOptions, timeout, ignoreErrors);
    }

    const exitCode = await exec.exec(command, args, {
      ...execOptions,
      ignoreReturnCode: true,
    });

    if (exitCode !== 0 && !ignoreErrors) {
      throw new Error(`Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}`);
    }

    return exitCode;
  }

  /**
   * Execute a command with a timeout that properly kills the process.
   * Uses Node's spawn directly to have control over the child process.
   */
  private execCommandWithKillableTimeout(
    command: string,
    args: string[],
    options: exec.ExecOptions,
    timeout: number,
    ignoreErrors: boolean
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let timedOut = false;

      // Spawn with detached: true so we can kill the process group
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env as NodeJS.ProcessEnv,
        shell: false,
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        core.warning(`Command timed out after ${timeout}ms, killing process: ${command}`);
        // Kill the process tree (negative PID kills process group)
        try {
          if (child.pid) {
            process.kill(-child.pid, 'SIGKILL');
          }
        } catch {
          // Fallback to killing just the child
          child.kill('SIGKILL');
        }
        reject(new Error(`Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`));
      }, timeout);

      child.on('error', (err) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(err);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          return; // Already rejected by timeout
        }

        const exitCode = code ?? 1;
        if (exitCode !== 0 && !ignoreErrors) {
          reject(
            new Error(`Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}`)
          );
        } else {
          resolve(exitCode);
        }
      });
    });
  }

  /**
   * Execute a command and capture its output.
   * @param command - The command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @param ignoreErrors - If true, don't throw on non-zero exit code
   */
  protected async execCommandWithOutput(
    command: string,
    args: string[] = [],
    options: exec.ExecOptions = {},
    ignoreErrors: boolean = false
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    let stdout = '';
    let stderr = '';

    const exitCode = await exec.exec(command, args, {
      ...options,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        },
      },
    });

    if (exitCode !== 0 && !ignoreErrors) {
      throw new Error(
        `Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}\nstderr: ${stderr}`
      );
    }

    return { exitCode, stdout, stderr };
  }

  /**
   * Execute a command with retry logic for transient failures.
   * @param command - The command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @param maxRetries - Maximum number of retries (default: 2)
   * @param delayMs - Initial delay between retries in ms (default: 5000)
   */
  protected async execCommandWithRetry(
    command: string,
    args: string[] = [],
    options: exec.ExecOptions = {},
    maxRetries: number = 2,
    delayMs: number = 5000
  ): Promise<number> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execCommand(command, args, options, false);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const waitTime = delayMs * Math.pow(2, attempt); // Exponential backoff
          core.warning(
            `Command failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitTime}ms: ${command} ${args.join(' ')}`
          );
          await this.sleep(waitTime);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Install pyelftools, required by all MicroPython native module toolchains.
   * This is a shared utility to avoid duplication across toolchain implementations.
   */
  protected async installPyelftools(): Promise<void> {
    core.info('Installing pyelftools...');
    await this.execCommand('pip', ['install', 'pyelftools>=0.25']);
  }
}
