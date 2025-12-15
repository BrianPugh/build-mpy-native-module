import * as core from '@actions/core';
import { saveCache } from './cache';
import { SINGLE_ARCHITECTURES } from './types';

async function post(): Promise<void> {
  let savedCount = 0;
  let skippedCount = 0;

  // Check for per-architecture cache state (new format)
  for (const arch of SINGLE_ARCHITECTURES) {
    const cacheKey = core.getState(`toolchain-cache-key-${arch}`);
    const cachePathsJson = core.getState(`toolchain-cache-paths-${arch}`);
    const cacheHit = core.getState(`toolchain-cache-hit-${arch}`) === 'true';

    if (!cacheKey || !cachePathsJson) {
      continue;
    }

    if (cacheHit) {
      core.info(`${arch}: Cache was hit, skipping save`);
      skippedCount++;
      continue;
    }

    const cachePaths: string[] = JSON.parse(cachePathsJson);
    core.info(`${arch}: Saving cache...`);
    await saveCache(cacheKey, cachePaths);
    savedCount++;
  }

  // Also check for legacy single-architecture state (backwards compatibility)
  const legacyCacheKey = core.getState('toolchain-cache-key');
  const legacyCachePathsJson = core.getState('toolchain-cache-paths');
  const legacyCacheHit = core.getState('toolchain-cache-hit') === 'true';

  if (legacyCacheKey && legacyCachePathsJson && !legacyCacheHit) {
    const cachePaths: string[] = JSON.parse(legacyCachePathsJson);
    core.info('Saving cache (legacy format)...');
    await saveCache(legacyCacheKey, cachePaths);
    savedCount++;
  } else if (legacyCacheKey && legacyCacheHit) {
    skippedCount++;
  }

  if (savedCount === 0 && skippedCount === 0) {
    core.info('No cache state found, skipping cache save');
  } else {
    core.info(`Cache summary: ${savedCount} saved, ${skippedCount} skipped (cache hit)`);
  }
}

post().catch((error) => {
  core.warning(`Post step failed: ${error instanceof Error ? error.message : String(error)}`);
});
