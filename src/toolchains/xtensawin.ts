import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';
import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
import {
  ESP_IDF_DIR,
  ESPRESSIF_HOME,
  CACHE_VERSION,
  TOOLCHAIN_BUILD_TIMEOUT_MS,
} from '../constants';

export class XtensawinToolchain extends BaseToolchain {
  readonly name = 'xtensawin';
  readonly architecture: Architecture = 'xtensawin';
  private readonly version: string;
  private capturedEnv: Record<string, string> = {};
  private capturedPathAdditions: string[] = [];

  constructor(version: string) {
    super();
    this.version = version;
  }

  async isAvailable(): Promise<boolean> {
    // Check if ESP-IDF is installed and the toolchain exists
    const idfPath = path.join(ESP_IDF_DIR, 'export.sh');
    const toolchainPath = path.join(ESPRESSIF_HOME, 'tools', 'xtensa-esp32-elf');
    return fs.existsSync(idfPath) && fs.existsSync(toolchainPath);
  }

  async setup(): Promise<void> {
    core.info('Setting up Xtensawin (ESP32) toolchain via ESP-IDF...');

    // Check if already available (from cache)
    if (await this.isAvailable()) {
      core.info('ESP-IDF already available, capturing environment...');
      await this.captureExportEnvironment();
      return;
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(ESP_IDF_DIR);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Clone ESP-IDF (with retry for transient network failures)
    // Use --depth 1 for faster clone - submodules are updated separately
    core.info(`Cloning ESP-IDF ${this.version}...`);
    await this.execCommandWithRetry('git', [
      'clone',
      '-b',
      this.version,
      '--depth',
      '1',
      'https://github.com/espressif/esp-idf.git',
      ESP_IDF_DIR,
    ]);

    // Update submodules (with retry - some may fail transiently)
    // Use --depth 1 for faster submodule clone
    core.info('Updating submodules...');
    await this.execCommandWithRetry(
      'git',
      ['submodule', 'update', '--init', '--recursive', '--depth', '1'],
      { cwd: ESP_IDF_DIR }
    );

    // Run install script (only install esp32 target to save time and disk space)
    // This can take 10+ minutes, so use a long timeout
    core.info('Running ESP-IDF install script for esp32 (this may take 10+ minutes)...');
    await this.execCommand('./install.sh', ['esp32'], {
      cwd: ESP_IDF_DIR,
      timeout: TOOLCHAIN_BUILD_TIMEOUT_MS,
    });

    // Capture environment variables from export.sh
    await this.captureExportEnvironment();

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('Xtensawin toolchain setup complete');
  }

  private async captureExportEnvironment(): Promise<void> {
    core.info('Capturing ESP-IDF environment variables...');

    // Get environment before sourcing export.sh
    const { stdout: beforeEnv } = await this.execCommandWithOutput('env', []);
    const beforeVars = this.parseEnvOutput(beforeEnv);

    // Run export.sh and capture environment
    const exportScript = `
      source ${ESP_IDF_DIR}/export.sh > /dev/null 2>&1
      env
    `;

    const { stdout: afterEnv } = await this.execCommandWithOutput('bash', ['-c', exportScript]);
    const afterVars = this.parseEnvOutput(afterEnv);

    // Find new or changed variables
    for (const [key, value] of Object.entries(afterVars)) {
      if (this.isRelevantEnvVar(key) && beforeVars[key] !== value) {
        this.capturedEnv[key] = value;
        core.info(`Captured env: ${key}`);
      }
    }

    // Special handling for PATH - capture new paths for later use
    // Use Set comparison to avoid substring matching bugs
    // (e.g., /foo/bar should not filter out /foo/bar/baz)
    if (afterVars['PATH'] && afterVars['PATH'] !== beforeVars['PATH']) {
      const beforePaths = new Set(beforeVars['PATH']?.split(':') || []);
      const newPaths = afterVars['PATH'].split(':').filter((p) => !beforePaths.has(p));
      this.capturedPathAdditions = newPaths;
      for (const p of newPaths) {
        core.info(`Captured PATH addition: ${p}`);
      }
    }
  }

  private parseEnvOutput(output: string): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.slice(0, eqIndex);
        const value = line.slice(eqIndex + 1);
        vars[key] = value;
      }
    }
    return vars;
  }

  private isRelevantEnvVar(key: string): boolean {
    const relevantPrefixes = ['IDF_', 'ESP_', 'OPENOCD', 'ESPRESSIF'];
    return relevantPrefixes.some((prefix) => key.startsWith(prefix));
  }

  getCacheConfig(): ToolchainCacheConfig {
    // Use centralized cache key format
    const cacheKey = `build-mpy-native-module-${CACHE_VERSION}-${this.architecture}-${this.version}`;
    const restoreKeys = [`build-mpy-native-module-${CACHE_VERSION}-${this.architecture}-`];

    return {
      architecture: this.architecture,
      cachePaths: [ESP_IDF_DIR, ESPRESSIF_HOME],
      cacheKey,
      restoreKeys,
    };
  }

  getPathAdditions(): string[] {
    return this.capturedPathAdditions;
  }

  getEnvironment(): Record<string, string> {
    return this.capturedEnv;
  }
}
