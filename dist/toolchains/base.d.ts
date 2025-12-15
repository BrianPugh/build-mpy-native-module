import * as exec from '@actions/exec';
import { Architecture, Toolchain, ToolchainCacheConfig } from '../types';
export interface ExecOptionsWithTimeout extends exec.ExecOptions {
    /** Timeout in milliseconds. If specified, the command will be aborted after this time. */
    timeout?: number;
}
export declare abstract class BaseToolchain implements Toolchain {
    abstract readonly name: string;
    abstract readonly architecture: Architecture;
    abstract setup(): Promise<void>;
    isAvailable(): Promise<boolean>;
    getCacheConfig(): ToolchainCacheConfig;
    getPathAdditions(): string[];
    getEnvironment(): Record<string, string>;
    /**
     * Execute a command with error handling and optional timeout.
     * When timeout is specified, the process is properly killed on timeout.
     * @param command - The command to execute
     * @param args - Command arguments
     * @param options - Execution options (including optional timeout)
     * @param ignoreErrors - If true, don't throw on non-zero exit code
     */
    protected execCommand(command: string, args?: string[], options?: ExecOptionsWithTimeout, ignoreErrors?: boolean): Promise<number>;
    /**
     * Execute a command with a timeout that properly kills the process.
     * Uses Node's spawn directly to have control over the child process.
     */
    private execCommandWithKillableTimeout;
    /**
     * Execute a command and capture its output.
     * @param command - The command to execute
     * @param args - Command arguments
     * @param options - Execution options
     * @param ignoreErrors - If true, don't throw on non-zero exit code
     */
    protected execCommandWithOutput(command: string, args?: string[], options?: exec.ExecOptions, ignoreErrors?: boolean): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
    /**
     * Execute a command with retry logic for transient failures.
     * @param command - The command to execute
     * @param args - Command arguments
     * @param options - Execution options
     * @param maxRetries - Maximum number of retries (default: 2)
     * @param delayMs - Initial delay between retries in ms (default: 5000)
     */
    protected execCommandWithRetry(command: string, args?: string[], options?: exec.ExecOptions, maxRetries?: number, delayMs?: number): Promise<number>;
    /**
     * Sleep for specified milliseconds.
     */
    protected sleep(ms: number): Promise<void>;
    /**
     * Install pyelftools, required by all MicroPython native module toolchains.
     * This is a shared utility to avoid duplication across toolchain implementations.
     */
    protected installPyelftools(): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map