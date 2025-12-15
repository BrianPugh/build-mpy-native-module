export const SINGLE_ARCHITECTURES = [
  'x86',
  'x64',
  'armv6m',
  'armv7m',
  'armv7emsp',
  'armv7emdp',
  'xtensa',
  'xtensawin',
  'rv32imc',
] as const;

export type SingleArchitecture = (typeof SINGLE_ARCHITECTURES)[number];

export const VALID_ARCHITECTURES = [...SINGLE_ARCHITECTURES, 'all'] as const;

export type Architecture = (typeof VALID_ARCHITECTURES)[number];

export interface Config {
  architecture: Architecture;
  architectures: SingleArchitecture[]; // Resolved list of architectures to build
  micropythonVersion: string; // Original input (may be comma-separated)
  micropythonVersions: string[]; // Parsed list of versions
  micropythonRepo: string; // MicroPython repository URL
  sourceDir: string;
  outputName: string;
  makeTarget: string;
  makeArgs: string;
  staticConstWorkaround: boolean;
  workaroundPatterns: string[];
  cacheToolchains: boolean;
  espIdfVersion: string;
  espOpenSdkRepo: string;
  espOpenSdkBranch: string;
  parallelBuilds: number; // 0 = sequential, 1-9 = max concurrent builds
}

export interface ToolchainEnv {
  pathAdditions: string[];
  environment: Record<string, string>;
}

export interface ToolchainCacheConfig {
  architecture: string;
  cachePaths: string[];
  cacheKey: string;
  restoreKeys: string[];
}

export interface Toolchain {
  readonly name: string;
  readonly architecture: Architecture;

  /** Check if toolchain is already available (from cache or system) */
  isAvailable(): Promise<boolean>;

  /** Setup the toolchain (install packages, clone repos, build) */
  setup(): Promise<void>;

  /** Get cache configuration */
  getCacheConfig(): ToolchainCacheConfig;

  /** Get PATH additions */
  getPathAdditions(): string[];

  /** Get environment variables to set for the build */
  getEnvironment(): Record<string, string>;
}
