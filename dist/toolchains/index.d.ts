import { SingleArchitecture, Config, Toolchain } from '../types';
export declare function createToolchain(architecture: SingleArchitecture, config: Config): Toolchain;
export { X86Toolchain, X64Toolchain } from './x86';
export { ARMToolchain } from './arm';
export { XtensaToolchain } from './xtensa';
export { XtensawinToolchain } from './xtensawin';
export { RV32IMCToolchain } from './rv32imc';
//# sourceMappingURL=index.d.ts.map