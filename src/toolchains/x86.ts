import * as core from '@actions/core';
import { Architecture } from '../types';
import { BaseToolchain } from './base';

export class X86Toolchain extends BaseToolchain {
  readonly name = 'x86';
  readonly architecture: Architecture = 'x86';

  async isAvailable(): Promise<boolean> {
    // Check if gcc-multilib is installed by looking for 32-bit libraries
    // and pyelftools is installed
    try {
      const { exitCode: gccCheck } = await this.execCommandWithOutput(
        'gcc',
        ['-m32', '-print-file-name=libc.a'],
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
    core.info('Setting up x86 toolchain...');

    // Check if already available
    if (await this.isAvailable()) {
      core.info('x86 toolchain already available, skipping setup');
      return;
    }

    // Install gcc-multilib for 32-bit compilation on 64-bit runners
    await this.execCommand('sudo', ['apt-get', 'update']);
    await this.execCommand('sudo', ['apt-get', 'install', '-y', 'gcc-multilib']);

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('x86 toolchain setup complete');
  }
}

export class X64Toolchain extends BaseToolchain {
  readonly name = 'x64';
  readonly architecture: Architecture = 'x64';

  async isAvailable(): Promise<boolean> {
    // Check if gcc and pyelftools are available
    try {
      const { exitCode: gccCheck } = await this.execCommandWithOutput(
        'gcc',
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
    core.info('Setting up x64 toolchain...');

    // Check if already available
    if (await this.isAvailable()) {
      core.info('x64 toolchain already available, skipping setup');
      return;
    }

    // x64 typically doesn't need gcc-multilib, just ensure gcc is available
    await this.execCommand('sudo', ['apt-get', 'update']);

    // Install pyelftools (shared utility)
    await this.installPyelftools();

    core.info('x64 toolchain setup complete');
  }
}
