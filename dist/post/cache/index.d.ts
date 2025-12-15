import { ToolchainCacheConfig } from '../types';
export declare class ToolchainCache {
    private cacheHit;
    private readonly cacheKey;
    private readonly cachePaths;
    private readonly restoreKeys;
    constructor(config: ToolchainCacheConfig);
    restore(): Promise<boolean>;
    getCacheHit(): boolean;
}
export declare function saveCache(cacheKey: string, cachePaths: string[]): Promise<void>;
//# sourceMappingURL=index.d.ts.map