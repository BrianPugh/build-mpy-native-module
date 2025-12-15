import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
export declare class XtensaToolchain extends BaseToolchain {
    readonly name = "xtensa";
    readonly architecture: Architecture;
    private readonly repo;
    private readonly branch;
    constructor(repo: string, branch: string);
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
    getCacheConfig(): ToolchainCacheConfig;
    getPathAdditions(): string[];
}
//# sourceMappingURL=xtensa.d.ts.map