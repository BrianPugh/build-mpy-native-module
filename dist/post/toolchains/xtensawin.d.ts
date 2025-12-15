import { Architecture, ToolchainCacheConfig } from '../types';
import { BaseToolchain } from './base';
export declare class XtensawinToolchain extends BaseToolchain {
    readonly name = "xtensawin";
    readonly architecture: Architecture;
    private readonly version;
    private capturedEnv;
    private capturedPathAdditions;
    constructor(version: string);
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
    private captureExportEnvironment;
    private parseEnvOutput;
    private isRelevantEnvVar;
    getCacheConfig(): ToolchainCacheConfig;
    getPathAdditions(): string[];
    getEnvironment(): Record<string, string>;
}
//# sourceMappingURL=xtensawin.d.ts.map