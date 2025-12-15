/**
 * Centralized cache version for all toolchains.
 * Increment this when cache format changes to invalidate all caches.
 */
export declare const CACHE_VERSION = "v2";
/**
 * Platform-aware base directories for toolchains.
 * Uses home directory to work on Linux, macOS, and Windows runners.
 */
export declare const TOOLCHAIN_BASE_DIR: string;
export declare const ESP_IDF_DIR: string;
export declare const ESPRESSIF_HOME: string;
export declare const ESP_OPEN_SDK_DIR: string;
export declare const ARM_TOOLCHAIN_DIR: string;
/**
 * MicroPython directory (also in home for consistency).
 */
export declare const MPY_DIR: string;
export declare const MPY_CROSS_PATH: string;
/**
 * Default timeout for long-running toolchain operations (30 minutes).
 */
export declare const TOOLCHAIN_BUILD_TIMEOUT_MS: number;
