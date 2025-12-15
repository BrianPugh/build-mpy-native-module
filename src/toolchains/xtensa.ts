import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';
import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
import { ESP_OPEN_SDK_DIR, CACHE_VERSION, TOOLCHAIN_BUILD_TIMEOUT_MS } from '../constants';

const TOOLCHAIN_BIN = path.join(ESP_OPEN_SDK_DIR, 'xtensa-lx106-elf', 'bin');

export class XtensaToolchain extends BaseToolchain {
  readonly name = 'xtensa';
  readonly architecture: Architecture = 'xtensa';
  private readonly repo: string;
  private readonly branch: string;

  constructor(repo: string, branch: string) {
    super();
    this.repo = repo;
    this.branch = branch;
  }

  async isAvailable(): Promise<boolean> {
    const gccPath = path.join(TOOLCHAIN_BIN, 'xtensa-lx106-elf-gcc');
    return fs.existsSync(gccPath);
  }

  async setup(): Promise<void> {
    core.info('Setting up Xtensa (ESP8266) toolchain...');

    // Check if already available (from cache)
    if (await this.isAvailable()) {
      core.info('Xtensa toolchain already available, skipping build');
      return;
    }

    // Install build dependencies
    core.info('Installing build dependencies...');
    await this.execCommand('sudo', ['apt-get', 'update']);
    await this.execCommand('sudo', [
      'apt-get',
      'install',
      '-y',
      'make',
      'unrar-free',
      'autoconf',
      'automake',
      'libtool',
      'gcc',
      'g++',
      'gperf',
      'flex',
      'bison',
      'texinfo',
      'gawk',
      'ncurses-dev',
      'libexpat-dev',
      'python3-dev',
      'python3-serial',
      'sed',
      'git',
      'help2man',
      'wget',
      'libtool-bin',
    ]);

    // Ensure parent directory exists
    const parentDir = path.dirname(ESP_OPEN_SDK_DIR);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Clone esp-open-sdk (with retry for transient network failures)
    core.info(`Cloning esp-open-sdk from ${this.repo} (branch: ${this.branch})...`);
    await this.execCommandWithRetry('git', [
      'clone',
      '--branch',
      this.branch,
      '--recursive',
      this.repo,
      ESP_OPEN_SDK_DIR,
    ]);

    // Build the toolchain (this takes ~15 minutes)
    core.info('Building Xtensa toolchain (this may take 15+ minutes)...');
    await this.execCommand('make', [], {
      cwd: ESP_OPEN_SDK_DIR,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: '', // Unset LD_LIBRARY_PATH to avoid conflicts
      },
      timeout: TOOLCHAIN_BUILD_TIMEOUT_MS,
    });

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('Xtensa toolchain setup complete');
  }

  getCacheConfig(): ToolchainCacheConfig {
    // Create a cache key based on the repo and branch
    const repoHash = Buffer.from(this.repo + this.branch)
      .toString('base64')
      .slice(0, 8);

    // Use centralized cache key format
    const cacheKey = `build-mpy-native-module-${CACHE_VERSION}-${this.architecture}-${repoHash}`;
    const restoreKeys = [`build-mpy-native-module-${CACHE_VERSION}-${this.architecture}-`];

    return {
      architecture: this.architecture,
      cachePaths: [ESP_OPEN_SDK_DIR],
      cacheKey,
      restoreKeys,
    };
  }

  getPathAdditions(): string[] {
    return [TOOLCHAIN_BIN];
  }
}
