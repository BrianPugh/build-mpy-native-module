import { Architecture } from '../types';
import { BaseToolchain } from './base';
export declare class X86Toolchain extends BaseToolchain {
    readonly name = "x86";
    readonly architecture: Architecture;
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
}
export declare class X64Toolchain extends BaseToolchain {
    readonly name = "x64";
    readonly architecture: Architecture;
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
}
//# sourceMappingURL=x86.d.ts.map