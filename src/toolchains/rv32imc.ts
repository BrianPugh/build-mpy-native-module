import * as core from '@actions/core';
import { Architecture } from '../types';
import { BaseToolchain } from './base';

export class RV32IMCToolchain extends BaseToolchain {
  readonly name = 'rv32imc';
  readonly architecture: Architecture = 'rv32imc';

  async isAvailable(): Promise<boolean> {
    // Check if RISC-V GCC and pyelftools are available
    try {
      const { exitCode: gccCheck } = await this.execCommandWithOutput(
        'riscv64-unknown-elf-gcc',
        ['--version'],
        {},
        true
      );
      const { exitCode: pyelfCheck } = await this.execCommandWithOutput(
        'python3',
        ['-c', 'import elftools'],
        {},
        true
      );
      return gccCheck === 0 && pyelfCheck === 0;
    } catch {
      return false;
    }
  }

  async setup(): Promise<void> {
    core.info('Setting up RISC-V (rv32imc) toolchain...');

    // Check if already available
    if (await this.isAvailable()) {
      core.info('RISC-V toolchain already available, skipping setup');
      return;
    }

    await this.execCommand('sudo', ['apt-get', 'update']);
    await this.execCommand('sudo', [
      'apt-get',
      'install',
      '-y',
      'gcc-riscv64-unknown-elf',
      'picolibc-riscv64-unknown-elf',
    ]);

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('RISC-V toolchain setup complete');
  }
}
