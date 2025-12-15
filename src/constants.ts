import * as os from 'os';
import * as path from 'path';

/**
 * Centralized cache version for all toolchains.
 * Increment this when cache format changes to invalidate all caches.
 */
export const CACHE_VERSION = 'v2';

/**
 * Platform-aware base directories for toolchains.
 * Uses home directory to work on Linux, macOS, and Windows runners.
 */
export const TOOLCHAIN_BASE_DIR = path.join(os.homedir(), '.mpy-toolchains');

export const ESP_IDF_DIR = path.join(TOOLCHAIN_BASE_DIR, 'esp-idf');
export const ESPRESSIF_HOME = path.join(TOOLCHAIN_BASE_DIR, 'espressif');
export const ESP_OPEN_SDK_DIR = path.join(TOOLCHAIN_BASE_DIR, 'esp-open-sdk');
export const ARM_TOOLCHAIN_DIR = path.join(TOOLCHAIN_BASE_DIR, 'arm-none-eabi-gcc');

/**
 * MicroPython directory (also in home for consistency).
 */
export const MPY_DIR = path.join(os.homedir(), 'micropython');
export const MPY_CROSS_PATH = path.join(MPY_DIR, 'mpy-cross', 'build', 'mpy-cross');

/**
 * Default timeout for long-running toolchain operations (30 minutes).
 */
export const TOOLCHAIN_BUILD_TIMEOUT_MS = 30 * 60 * 1000;
