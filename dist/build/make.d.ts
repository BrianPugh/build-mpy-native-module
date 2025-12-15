import { Config, ToolchainEnv } from '../types';
export interface BuildResult {
    mpyFile: string;
    moduleName: string;
    buildDir?: string;
}
export interface RunMakeOptions {
    config: Config;
    toolchainEnv?: ToolchainEnv;
    /** Number of concurrent builds running (used to calculate make -j) */
    concurrentBuilds?: number;
}
export declare function runMake(options: RunMakeOptions): Promise<BuildResult>;
/**
 * Clean up an isolated build directory.
 */
export declare function cleanupBuildDir(buildDir: string | undefined): void;
/** Exported for testing */
export declare function findMpyFile(sourceDir: string, expectedName?: string): Promise<string | null>;
//# sourceMappingURL=make.d.ts.map