import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
type ArmArchitecture = 'armv6m' | 'armv7m' | 'armv7emsp' | 'armv7emdp';
export declare class ARMToolchain extends BaseToolchain {
    readonly name: string;
    readonly architecture: Architecture;
    private readonly toolchainPath;
    constructor(architecture: ArmArchitecture);
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
    getCacheConfig(): ToolchainCacheConfig;
    getPathAdditions(): string[];
}
export {};
//# sourceMappingURL=arm.d.ts.map