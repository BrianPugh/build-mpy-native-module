import { Architecture } from '../types';
import { BaseToolchain } from './base';
export declare class RV32IMCToolchain extends BaseToolchain {
    readonly name = "rv32imc";
    readonly architecture: Architecture;
    isAvailable(): Promise<boolean>;
    setup(): Promise<void>;
}
//# sourceMappingURL=rv32imc.d.ts.map