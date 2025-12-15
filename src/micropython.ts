import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MPY_DIR, MPY_CROSS_PATH, CACHE_VERSION } from './constants';
import { execWithRetry } from './utils';

export async function setupMicroPython(
  version: string,
  repository: string = 'https://github.com/micropython/micropython'
): Promise<void> {
  core.info(`Setting up MicroPython ${version}...`);

  // Normalize version (ensure it starts with 'v')
  const normalizedVersion = version.startsWith('v') ? version : `v${version}`;

  // Try to restore from cache
  const cacheKey = `micropython-${CACHE_VERSION}-${normalizedVersion}`;
  const cachePaths = [MPY_DIR];

  let cacheHit = false;
  try {
    const matchedKey = await cache.restoreCache(cachePaths, cacheKey);
    cacheHit = matchedKey === cacheKey;
    if (cacheHit) {
      core.info('MicroPython restored from cache');
    }
  } catch (error) {
    core.warning(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!cacheHit || !fs.existsSync(MPY_CROSS_PATH)) {
    // Clone MicroPython repository (with retry for transient network failures)
    core.info(`Cloning MicroPython ${normalizedVersion}...`);

    if (fs.existsSync(MPY_DIR)) {
      await exec.exec('rm', ['-rf', MPY_DIR]);
    }

    await execWithRetry('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      normalizedVersion,
      repository,
      MPY_DIR,
    ]);

    // Build mpy-cross
    core.info('Building mpy-cross...');
    const numCpus = os.cpus().length;
    await exec.exec('make', [`-j${numCpus}`], {
      cwd: path.join(MPY_DIR, 'mpy-cross'),
    });

    // Save to cache
    try {
      await cache.saveCache(cachePaths, cacheKey);
      core.info('MicroPython saved to cache');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        core.info('Cache already exists');
      } else {
        core.warning(
          `Cache save failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Export MPY_DIR environment variable
  core.exportVariable('MPY_DIR', MPY_DIR);
  core.info(`MPY_DIR set to: ${MPY_DIR}`);

  // Add mpy-cross to PATH
  const mpyCrossBinDir = path.dirname(MPY_CROSS_PATH);
  core.addPath(mpyCrossBinDir);
}

export function getMicroPythonMajorMinor(version: string): string {
  // Extract major.minor from version string like "v1.22.2" or "1.22.2"
  const normalized = version.replace(/^v/, '');
  const parts = normalized.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return normalized;
}
