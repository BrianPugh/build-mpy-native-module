import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MPY_DIR, MPY_CROSS_PATH, CACHE_VERSION } from './constants';
import { execWithRetry } from './utils';
import { isMicropythonReleaseVersion } from './mpy-versions';

/**
 * Resolve a named ref (branch or tag) to its commit SHA on the remote.
 * Returns null if the remote has no such ref (e.g. the ref is a bare SHA).
 */
async function resolveRemoteRef(repository: string, ref: string): Promise<string | null> {
  try {
    const output = await exec.getExecOutput('git', ['ls-remote', '--', repository, ref], {
      silent: true,
    });
    const sha = output.stdout.trim().split('\n')[0]?.split(/\s+/)[0];
    return sha || null;
  } catch {
    return null;
  }
}

export async function setupMicroPython(
  version: string,
  repository: string = 'https://github.com/micropython/micropython'
): Promise<void> {
  core.info(`Setting up MicroPython ${version}...`);

  // Release versions are normalized to their tag name (v-prefixed); anything
  // else is a git ref (branch or commit SHA) used verbatim.
  const isRelease = isMicropythonReleaseVersion(version);
  const gitRef = isRelease && !version.startsWith('v') ? `v${version}` : version;

  // Release tags are immutable, so they can key the cache directly. Branches
  // move, so resolve them to a commit SHA first; if the remote has no such
  // named ref, assume the ref itself is a bare commit SHA.
  let cacheId = gitRef;
  let isNamedRef = true;
  if (!isRelease) {
    const resolvedSha = await resolveRemoteRef(repository, gitRef);
    if (resolvedSha) {
      cacheId = resolvedSha;
      core.info(`Resolved ref "${gitRef}" to ${resolvedSha}`);
    } else {
      isNamedRef = false;
      core.info(`"${gitRef}" is not a named ref on the remote; treating it as a commit SHA`);
    }
  }

  // Try to restore from cache
  const cacheKey = `micropython-${CACHE_VERSION}-${cacheId}`;
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
    core.info(`Cloning MicroPython ${gitRef}...`);

    if (fs.existsSync(MPY_DIR)) {
      await exec.exec('rm', ['-rf', MPY_DIR]);
    }

    if (isNamedRef) {
      // Tags and branches can be cloned shallowly
      await execWithRetry('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        gitRef,
        repository,
        MPY_DIR,
      ]);
    } else {
      // A bare commit SHA cannot be passed to --branch; full clone, then checkout
      await execWithRetry('git', ['clone', repository, MPY_DIR]);
      await exec.exec('git', ['-c', 'advice.detachedHead=false', 'checkout', gitRef], {
        cwd: MPY_DIR,
      });
    }

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
