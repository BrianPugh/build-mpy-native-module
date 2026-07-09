import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveArchitectures, validateInputs, ValidationError } from '../validation';
import {
  mpyVersionSupportsRv32imc,
  micropythonVersionSupportsRv32imc,
  targetSupportsRv32imc,
  VALID_MPY_VERSIONS,
  MPY_VERSION_MAP,
} from '../mpy-versions';
import { SINGLE_ARCHITECTURES, BuildTarget } from '../types';

/** Build target for an mpy version using its recommended MicroPython version. */
function mpyTarget(mpyVersion: string): BuildTarget {
  return { mpyVersion, micropythonVersion: MPY_VERSION_MAP[mpyVersion] };
}

// Mock @actions/core
jest.mock('@actions/core');

describe('mpyVersionSupportsRv32imc', () => {
  it('returns true for mpy 6.3', () => {
    expect(mpyVersionSupportsRv32imc('6.3')).toBe(true);
  });

  it('returns false for mpy versions < 6.3', () => {
    expect(mpyVersionSupportsRv32imc('6.2')).toBe(false);
    expect(mpyVersionSupportsRv32imc('6.1')).toBe(false);
    expect(mpyVersionSupportsRv32imc('6')).toBe(false);
    expect(mpyVersionSupportsRv32imc('5')).toBe(false);
  });
});

describe('micropythonVersionSupportsRv32imc', () => {
  it('returns false for MicroPython < 1.25.0', () => {
    expect(micropythonVersionSupportsRv32imc('v1.20.0')).toBe(false);
    expect(micropythonVersionSupportsRv32imc('v1.22.2')).toBe(false);
    expect(micropythonVersionSupportsRv32imc('v1.24.1')).toBe(false);
    expect(micropythonVersionSupportsRv32imc('v1.24.9')).toBe(false);
    expect(micropythonVersionSupportsRv32imc('1.24.0')).toBe(false); // Without v prefix
  });

  it('returns true for MicroPython >= 1.25.0', () => {
    expect(micropythonVersionSupportsRv32imc('v1.25.0')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.25.1')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.26.0')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.27.0')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('1.25.0')).toBe(true); // Without v prefix
  });

  it('returns true for MicroPython major version > 1', () => {
    expect(micropythonVersionSupportsRv32imc('v2.0.0')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v3.0.0')).toBe(true);
  });

  it('handles pre-release versions correctly', () => {
    // Pre-release of 1.25.0 should be treated as 1.25.0 for rv32imc support
    expect(micropythonVersionSupportsRv32imc('v1.25.0-preview')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.25.0-preview.1')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.25.0-alpha')).toBe(true);
    expect(micropythonVersionSupportsRv32imc('v1.25.0-beta.2')).toBe(true);
    // Pre-release of 1.24.x should still be false
    expect(micropythonVersionSupportsRv32imc('v1.24.0-preview')).toBe(false);
    expect(micropythonVersionSupportsRv32imc('v1.24.1-rc1')).toBe(false);
  });
});

describe('targetSupportsRv32imc', () => {
  it('returns true for mpy 6.3 with its recommended MicroPython version', () => {
    expect(targetSupportsRv32imc(mpyTarget('6.3'))).toBe(true);
  });

  it('returns false for mpy versions < 6.3', () => {
    expect(targetSupportsRv32imc(mpyTarget('6.2'))).toBe(false);
    expect(targetSupportsRv32imc(mpyTarget('6.1'))).toBe(false);
    expect(targetSupportsRv32imc(mpyTarget('6'))).toBe(false);
    expect(targetSupportsRv32imc(mpyTarget('5'))).toBe(false);
  });

  it('returns false for mpy 6.3 targets built with MicroPython < 1.25.0', () => {
    // mpy 6.3 spans v1.23.0+, but rv32imc only exists in MicroPython >= 1.25.0
    expect(targetSupportsRv32imc({ mpyVersion: '6.3', micropythonVersion: 'v1.23.0' })).toBe(false);
    expect(targetSupportsRv32imc({ mpyVersion: '6.3', micropythonVersion: 'v1.24.1' })).toBe(false);
    expect(targetSupportsRv32imc({ mpyVersion: '6.3', micropythonVersion: 'v1.25.0' })).toBe(true);
  });
});

describe('resolveArchitectures', () => {
  it('returns all architectures including rv32imc for mpy 6.3', () => {
    const archs = resolveArchitectures('all', [mpyTarget('6.3')]);
    expect(archs).toEqual([...SINGLE_ARCHITECTURES]);
    expect(archs).toContain('rv32imc');
  });

  it('excludes rv32imc for mpy versions < 6.3', () => {
    const archs = resolveArchitectures('all', [mpyTarget('6.2')]);
    expect(archs).not.toContain('rv32imc');
    expect(archs.length).toBe(SINGLE_ARCHITECTURES.length - 1);

    const archs6 = resolveArchitectures('all', [mpyTarget('6')]);
    expect(archs6).not.toContain('rv32imc');

    const archs5 = resolveArchitectures('all', [mpyTarget('5')]);
    expect(archs5).not.toContain('rv32imc');
  });

  it('includes rv32imc when any target supports it', () => {
    const archs = resolveArchitectures('all', [mpyTarget('6.2'), mpyTarget('6.3')]);
    expect(archs).toContain('rv32imc');
  });

  it('excludes rv32imc for mpy 6.3 targets built with MicroPython < 1.25.0', () => {
    const archs = resolveArchitectures('all', [
      { mpyVersion: '6.3', micropythonVersion: 'v1.24.1' },
    ]);
    expect(archs).not.toContain('rv32imc');
  });

  it('returns single architecture when specified', () => {
    expect(resolveArchitectures('x64', [mpyTarget('6.2')])).toEqual(['x64']);
    expect(resolveArchitectures('armv6m', [mpyTarget('6.2')])).toEqual(['armv6m']);
    expect(resolveArchitectures('xtensawin', [mpyTarget('6.2')])).toEqual(['xtensawin']);
  });

  it('returns rv32imc when explicitly requested for mpy 6.3', () => {
    expect(resolveArchitectures('rv32imc', [mpyTarget('6.3')])).toEqual(['rv32imc']);
  });
});

describe('MPY_VERSION_MAP', () => {
  it('contains all valid mpy versions', () => {
    for (const version of VALID_MPY_VERSIONS) {
      expect(MPY_VERSION_MAP[version]).toBeDefined();
    }
  });

  it('maps to expected MicroPython versions', () => {
    expect(MPY_VERSION_MAP['6.3']).toBe('v1.27.0');
    expect(MPY_VERSION_MAP['6.2']).toBe('v1.22.2');
    expect(MPY_VERSION_MAP['6.1']).toBe('v1.21.0');
    expect(MPY_VERSION_MAP['6']).toBe('v1.19.1');
    expect(MPY_VERSION_MAP['5']).toBe('v1.18');
  });
});

describe('validateInputs', () => {
  const mockedCore = core as jest.Mocked<typeof core>;
  let tempDir: string;

  beforeEach(() => {
    jest.resetAllMocks();
    // Create a temp directory with a Makefile for source-dir validation
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-inputs-test-'));
    fs.writeFileSync(path.join(tempDir, 'Makefile'), 'MOD = testmodule\n');

    // Default mock setup - empty inputs
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      return '';
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws error when both mpy-version and micropython-version are provided', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'mpy-version') return '6.3';
      if (name === 'micropython-version') return 'v1.22.2';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow(
      'Cannot specify both mpy-version and micropython-version'
    );
  });

  it('uses default mpy-version 6.3 when neither input is provided', () => {
    const config = validateInputs();
    expect(config.buildTargets).toHaveLength(1);
    expect(config.buildTargets[0].mpyVersion).toBe('6.3');
    expect(config.buildTargets[0].micropythonVersion).toBe('v1.27.0');
  });

  it('parses mpy-version: all correctly', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'mpy-version') return 'all';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets).toHaveLength(VALID_MPY_VERSIONS.length);
  });

  it('throws error for invalid mpy-version', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'mpy-version') return '7.0';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow('Invalid mpy-version "7.0"');
  });

  it('throws error for micropython-version older than v1.12', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'micropython-version') return 'v1.11.0';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow('too old');
  });

  it('accepts micropython-version v1.12 (mpy 5)', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'micropython-version') return 'v1.12.0';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets[0].mpyVersion).toBe('5');
    expect(config.buildTargets[0].micropythonVersion).toBe('v1.12.0');
  });

  it('accepts micropython-versions with distinct mpy subversions', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'micropython-version') return 'v1.21.0, v1.22.2, v1.25.0';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets.map((t) => t.mpyVersion)).toEqual(['6.1', '6.2', '6.3']);
  });

  it('throws error when micropython-versions produce the same mpy subversion', () => {
    // v1.23.0, v1.24.1, and v1.25.0 all produce mpy 6.3; output filenames would collide
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'micropython-version') return 'v1.23.0, v1.25.0';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow('both produce mpy 6.3');
  });

  it('deduplicates exact micropython-version repeats', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'micropython-version') return 'v1.25.0, 1.25.0';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets).toHaveLength(1);
    expect(config.buildTargets[0].micropythonVersion).toBe('v1.25.0');
  });

  it('throws error when rv32imc is requested for mpy < 6.3', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'rv32imc';
      if (name === 'mpy-version') return '6.2';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow('rv32imc requires mpy 6.3+');
  });

  it('throws error when rv32imc is requested for micropython-version < 1.25.0', () => {
    // v1.24.1 derives mpy 6.3, but rv32imc only exists in MicroPython >= 1.25.0
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'rv32imc';
      if (name === 'micropython-version') return 'v1.24.1';
      return '';
    });

    expect(() => validateInputs()).toThrow(ValidationError);
    expect(() => validateInputs()).toThrow('rv32imc requires mpy 6.3+');
  });

  it('allows rv32imc for micropython-version >= 1.25.0', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'rv32imc';
      if (name === 'micropython-version') return 'v1.25.0';
      return '';
    });

    const config = validateInputs();
    expect(config.architectures).toContain('rv32imc');
  });

  it('filters rv32imc from "all" architectures for micropython-version < 1.25.0', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'all';
      if (name === 'micropython-version') return 'v1.24.1';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets[0].mpyVersion).toBe('6.3');
    expect(config.architectures).not.toContain('rv32imc');
  });

  it('allows rv32imc for mpy 6.3', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'rv32imc';
      if (name === 'mpy-version') return '6.3';
      return '';
    });

    const config = validateInputs();
    expect(config.architectures).toContain('rv32imc');
  });

  it('filters rv32imc from architectures when mpy-version: all includes older versions', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'architecture') return 'all';
      if (name === 'mpy-version') return 'all';
      return '';
    });

    const config = validateInputs();
    // The resolved architectures should include rv32imc since the highest mpy version (6.3) supports it
    // Individual builds for older mpy versions will filter it out at runtime
    expect(config.architectures).toContain('rv32imc');
  });

  it('parses comma-separated mpy-version list', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'mpy-version') return '6.2, 6.3';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets).toHaveLength(2);
    expect(config.buildTargets.map((t) => t.mpyVersion)).toEqual(['6.2', '6.3']);
  });

  it('deduplicates mpy-version list', () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'source-dir') return tempDir;
      if (name === 'mpy-version') return '6.3, 6.3, 6.2, 6.3';
      return '';
    });

    const config = validateInputs();
    expect(config.buildTargets).toHaveLength(2);
  });
});
