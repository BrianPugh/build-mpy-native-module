export declare const SINGLE_ARCHITECTURES: readonly ["x86", "x64", "armv6m", "armv7m", "armv7emsp", "armv7emdp", "xtensa", "xtensawin", "rv32imc"];
export type SingleArchitecture = (typeof SINGLE_ARCHITECTURES)[number];
export declare const VALID_ARCHITECTURES: readonly ["x86", "x64", "armv6m", "armv7m", "armv7emsp", "armv7emdp", "xtensa", "xtensawin", "rv32imc", "all"];
export type Architecture = (typeof VALID_ARCHITECTURES)[number];
export interface Config {
    architecture: Architecture;
    architectures: SingleArchitecture[];
    micropythonVersion: string;
    micropythonVersions: string[];
    micropythonRepo: string;
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
    parallelBuilds: number;
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
