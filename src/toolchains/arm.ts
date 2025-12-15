import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as path from 'path';
import * as fs from 'fs';
import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
import { ARM_TOOLCHAIN_DIR, CACHE_VERSION } from '../constants';

// ARM GNU Toolchain release info
const ARM_TOOLCHAIN_VERSION = '13.2.rel1';
const ARM_TOOLCHAIN_URL = `https://developer.arm.com/-/media/Files/downloads/gnu/${ARM_TOOLCHAIN_VERSION}/binrel/arm-gnu-toolchain-${ARM_TOOLCHAIN_VERSION}-x86_64-arm-none-eabi.tar.xz`;

type ArmArchitecture = 'armv6m' | 'armv7m' | 'armv7emsp' | 'armv7emdp';

export class ARMToolchain extends BaseToolchain {
  readonly name: string;
  readonly architecture: Architecture;
  private readonly toolchainPath: string;

  constructor(architecture: ArmArchitecture) {
    super();
    this.architecture = architecture;
    this.name = `arm-${architecture}`;
    this.toolchainPath = ARM_TOOLCHAIN_DIR;
  }

  async isAvailable(): Promise<boolean> {
    const gccPath = path.join(this.toolchainPath, 'bin', 'arm-none-eabi-gcc');
    return fs.existsSync(gccPath);
  }

  async setup(): Promise<void> {
    core.info(`Setting up ARM toolchain for ${this.architecture}...`);

    // Check if already available (from cache)
    if (await this.isAvailable()) {
      core.info('ARM toolchain already available, skipping download');
      return;
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(this.toolchainPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Download and extract ARM toolchain
    core.info(`Downloading ARM GNU Toolchain ${ARM_TOOLCHAIN_VERSION}...`);
    const downloadPath = await tc.downloadTool(ARM_TOOLCHAIN_URL);

    core.info('Extracting toolchain...');
    const extractDir = path.dirname(this.toolchainPath);
    await tc.extractTar(downloadPath, extractDir, ['x', '--xz']);

    // The extracted folder has a long name, rename it
    const extractedDir = fs.readdirSync(extractDir).find((d) => d.startsWith('arm-gnu-toolchain'));
    if (extractedDir) {
      const fullExtractedPath = path.join(extractDir, extractedDir);
      fs.renameSync(fullExtractedPath, this.toolchainPath);
    }

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('ARM toolchain setup complete');
  }

  getCacheConfig(): ToolchainCacheConfig {
    // Use shared cache key for all ARM variants since they use the same toolchain
    // This prevents caching the same ~400MB toolchain 4 times
    const sharedCacheKey = `build-mpy-native-module-${CACHE_VERSION}-arm-${ARM_TOOLCHAIN_VERSION}`;
    const sharedRestoreKeys = [`build-mpy-native-module-${CACHE_VERSION}-arm-`];

    return {
      architecture: this.architecture,
      cachePaths: [this.toolchainPath],
      cacheKey: sharedCacheKey,
      restoreKeys: sharedRestoreKeys,
    };
  }

  getPathAdditions(): string[] {
    return [path.join(this.toolchainPath, 'bin')];
  }
}
