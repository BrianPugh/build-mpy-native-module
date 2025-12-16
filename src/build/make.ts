import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Config, ToolchainEnv } from '../types';
import { applyStaticConstWorkaround } from './workarounds';

export interface BuildResult {
  mpyFile: string;
  moduleName: string;
  buildDir?: string; // Set if an isolated build dir was used; caller should clean up after copying
}

export interface RunMakeOptions {
  config: Config;
  toolchainEnv?: ToolchainEnv;
  /** Number of concurrent builds running (used to calculate make -j) */
  concurrentBuilds?: number;
}

/**
 * Copy source directory contents to a temporary build directory.
 * This enables parallel builds without file collisions.
 */
async function createIsolatedBuildDir(sourceDir: string, architecture: string): Promise<string> {
  const tempBase = path.join(os.tmpdir(), 'mpy-build');
  const buildDir = path.join(tempBase, `${architecture}-${Date.now()}`);

  // Create temp directory
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy source files (excluding dist, .git, node_modules)
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(buildDir, entry.name);

    // Skip directories we don't need
    if (
      entry.isDirectory() &&
      ['dist', '.git', 'node_modules', '.mpy_build'].includes(entry.name)
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return buildDir;
}

/**
 * Recursively copy a directory.
 */
async function copyDir(src: string, dest: string): Promise<void> {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function runMake(options: RunMakeOptions): Promise<BuildResult> {
  const { config, toolchainEnv, concurrentBuilds = 1 } = options;
  const { architecture, sourceDir, makeTarget, makeArgs, mpyCrossArgs } = config;

  core.info(`Building native module for ${architecture}...`);

  // Always use isolated build directory to:
  // 1. Enable parallel builds without file collisions
  // 2. Protect user source files from modification (e.g., static const workaround)
  const buildDir = await createIsolatedBuildDir(sourceDir, architecture);
  core.debug(`Using isolated build directory: ${buildDir}`);

  // Apply static const workaround to the isolated copy (not user's source)
  if (config.staticConstWorkaround) {
    await applyStaticConstWorkaround(buildDir, config.workaroundPatterns);
  }

  // Build custom environment if toolchainEnv is provided
  let execEnv: Record<string, string> | undefined;
  if (toolchainEnv) {
    execEnv = { ...process.env } as Record<string, string>;
    // Prepend toolchain paths to PATH
    if (toolchainEnv.pathAdditions.length > 0) {
      const currentPath = execEnv.PATH || '';
      execEnv.PATH = [...toolchainEnv.pathAdditions, currentPath].join(path.delimiter);
    }
    // Add toolchain environment variables
    Object.assign(execEnv, toolchainEnv.environment);
  }

  const execOptions: exec.ExecOptions = {
    cwd: buildDir,
    ...(execEnv && { env: execEnv }),
  };

  // Clean first
  core.info('Running make clean...');
  try {
    await exec.exec('make', ['clean'], execOptions);
  } catch {
    // Ignore clean errors
    core.debug('make clean failed or no clean target, continuing...');
  }

  // Build arguments
  const args: string[] = [];

  // Add architecture
  args.push(`ARCH=${architecture}`);

  // Add parallel jobs (use fewer jobs if running parallel builds to avoid resource contention)
  // If concurrentBuilds > 1, divide available CPUs among the builds
  const numCpus = os.cpus().length;
  const effectiveConcurrency = Math.max(1, concurrentBuilds);
  const makeJobs = Math.max(1, Math.floor(numCpus / effectiveConcurrency));
  args.push(`-j${makeJobs}`);

  // Add mpy-cross args if specified
  // We need to construct MPY_CROSS_FLAGS with both -march=$(ARCH) and user args
  // because Make command-line variables override Makefile variables
  if (mpyCrossArgs) {
    args.push(`MPY_CROSS_FLAGS=-march=${architecture} ${mpyCrossArgs}`);
  }

  // Add custom make args
  if (makeArgs) {
    args.push(...makeArgs.split(/\s+/).filter(Boolean));
  }

  // Add target if specified
  if (makeTarget) {
    args.push(makeTarget);
  }

  core.info(`Running: make ${args.join(' ')}`);
  await exec.exec('make', args, execOptions);

  // Find the built .mpy file
  const mpyFile = await findMpyFile(buildDir, config.outputName || undefined);
  if (!mpyFile) {
    throw new Error('Build completed but no .mpy file was found');
  }

  const moduleName = path.basename(mpyFile, '.mpy');
  core.info(`Built: ${mpyFile}`);

  return {
    mpyFile,
    moduleName,
    // Include buildDir so caller can clean up after copying
    buildDir,
  };
}

/**
 * Clean up an isolated build directory.
 */
export function cleanupBuildDir(buildDir: string | undefined): void {
  if (!buildDir) return;

  try {
    fs.rmSync(buildDir, { recursive: true, force: true });
    core.debug(`Cleaned up build directory: ${buildDir}`);
  } catch (error) {
    // Non-fatal - log warning but don't fail
    core.debug(
      `Failed to clean up build directory ${buildDir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** Exported for testing */
export async function findMpyFile(
  sourceDir: string,
  expectedName?: string
): Promise<string | null> {
  // Look for .mpy files in the source directory
  const globber = await glob.create(path.join(sourceDir, '*.mpy'));
  const files = await globber.glob();

  if (files.length === 0) {
    return null;
  }

  // If we have an expected name, prefer that file
  if (expectedName) {
    const expectedFile = files.find(
      (f) => path.basename(f, '.mpy') === expectedName || path.basename(f) === expectedName
    );
    if (expectedFile) {
      return expectedFile;
    }
    // Expected name not found, log a warning and fall through to default logic
    core.warning(
      `Expected output file "${expectedName}.mpy" not found, using most recent .mpy file`
    );
  }

  if (files.length === 1) {
    return files[0];
  }

  // If multiple .mpy files, return the most recently modified one
  let newest: { file: string; mtime: number } | null = null;

  for (const file of files) {
    const stat = fs.statSync(file);
    if (!newest || stat.mtimeMs > newest.mtime) {
      newest = { file, mtime: stat.mtimeMs };
    }
  }

  return newest?.file ?? null;
}
