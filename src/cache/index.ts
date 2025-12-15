import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { ToolchainCacheConfig } from '../types';

export class ToolchainCache {
  private cacheHit: boolean = false;
  private readonly cacheKey: string;
  private readonly cachePaths: string[];
  private readonly restoreKeys: string[];

  constructor(config: ToolchainCacheConfig) {
    this.cacheKey = config.cacheKey;
    this.cachePaths = config.cachePaths;
    this.restoreKeys = config.restoreKeys;
  }

  async restore(): Promise<boolean> {
    if (!this.cacheKey || this.cachePaths.length === 0) {
      core.info('No cache configuration, skipping restore');
      return false;
    }

    try {
      core.info(`Attempting to restore cache with key: ${this.cacheKey}`);
      const matchedKey = await cache.restoreCache(this.cachePaths, this.cacheKey, this.restoreKeys);

      if (matchedKey) {
        this.cacheHit = matchedKey === this.cacheKey;
        core.info(`Cache restored from key: ${matchedKey} (exact match: ${this.cacheHit})`);
        return true;
      } else {
        core.info('No cache found');
        return false;
      }
    } catch (error) {
      core.warning(
        `Cache restore failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  getCacheHit(): boolean {
    return this.cacheHit;
  }
}

export async function saveCache(cacheKey: string, cachePaths: string[]): Promise<void> {
  if (!cacheKey || cachePaths.length === 0) {
    core.info('No cache configuration, skipping save');
    return;
  }

  try {
    core.info(`Saving cache with key: ${cacheKey}`);
    await cache.saveCache(cachePaths, cacheKey);
    core.info('Cache saved successfully');
  } catch (error) {
    // Cache save failures should not fail the action
    if (error instanceof Error && error.message.includes('already exists')) {
      core.info('Cache already exists, skipping save');
    } else {
      core.warning(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
