import { SingleArchitecture, Config, Toolchain } from '../types';
import { X86Toolchain, X64Toolchain } from './x86';
import { ARMToolchain } from './arm';
import { XtensaToolchain } from './xtensa';
import { XtensawinToolchain } from './xtensawin';
import { RV32IMCToolchain } from './rv32imc';

export function createToolchain(architecture: SingleArchitecture, config: Config): Toolchain {
  switch (architecture) {
    case 'x86':
      return new X86Toolchain();

    case 'x64':
      return new X64Toolchain();

    case 'armv6m':
    case 'armv7m':
    case 'armv7emsp':
    case 'armv7emdp':
      return new ARMToolchain(architecture);

    case 'xtensa':
      return new XtensaToolchain(config.espOpenSdkRepo, config.espOpenSdkBranch);

    case 'xtensawin':
      return new XtensawinToolchain(config.espIdfVersion);

    case 'rv32imc':
      return new RV32IMCToolchain();

    default:
      throw new Error(`Unsupported architecture: ${architecture}`);
  }
}

export { X86Toolchain, X64Toolchain } from './x86';
export { ARMToolchain } from './arm';
export { XtensaToolchain } from './xtensa';
export { XtensawinToolchain } from './xtensawin';
export { RV32IMCToolchain } from './rv32imc';
