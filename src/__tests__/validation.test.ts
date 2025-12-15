import { supportsRv32imc, resolveArchitectures } from '../validation';
import { SINGLE_ARCHITECTURES } from '../types';

describe('supportsRv32imc', () => {
  it('returns false for MicroPython < 1.25.0', () => {
    expect(supportsRv32imc('v1.20.0')).toBe(false);
    expect(supportsRv32imc('v1.22.2')).toBe(false);
    expect(supportsRv32imc('v1.24.1')).toBe(false);
    expect(supportsRv32imc('v1.24.9')).toBe(false);
    expect(supportsRv32imc('1.24.0')).toBe(false); // Without v prefix
  });

  it('returns true for MicroPython >= 1.25.0', () => {
    expect(supportsRv32imc('v1.25.0')).toBe(true);
    expect(supportsRv32imc('v1.25.1')).toBe(true);
    expect(supportsRv32imc('v1.26.0')).toBe(true);
    expect(supportsRv32imc('v1.27.0')).toBe(true);
    expect(supportsRv32imc('1.25.0')).toBe(true); // Without v prefix
  });

  it('returns true for MicroPython major version > 1', () => {
    expect(supportsRv32imc('v2.0.0')).toBe(true);
    expect(supportsRv32imc('v3.0.0')).toBe(true);
  });

  it('handles pre-release versions correctly', () => {
    // Pre-release of 1.25.0 should be treated as 1.25.0 for rv32imc support
    expect(supportsRv32imc('v1.25.0-preview')).toBe(true);
    expect(supportsRv32imc('v1.25.0-preview.1')).toBe(true);
    expect(supportsRv32imc('v1.25.0-alpha')).toBe(true);
    expect(supportsRv32imc('v1.25.0-beta.2')).toBe(true);
    // Pre-release of 1.24.x should still be false
    expect(supportsRv32imc('v1.24.0-preview')).toBe(false);
    expect(supportsRv32imc('v1.24.1-rc1')).toBe(false);
  });
});

describe('resolveArchitectures', () => {
  it('returns all architectures including rv32imc for versions >= 1.25.0', () => {
    const archs = resolveArchitectures('all', 'v1.25.0');
    expect(archs).toEqual([...SINGLE_ARCHITECTURES]);
    expect(archs).toContain('rv32imc');
  });

  it('excludes rv32imc for versions < 1.25.0', () => {
    const archs = resolveArchitectures('all', 'v1.24.1');
    expect(archs).not.toContain('rv32imc');
    expect(archs.length).toBe(SINGLE_ARCHITECTURES.length - 1);
  });

  it('returns single architecture when specified', () => {
    expect(resolveArchitectures('x64', 'v1.24.1')).toEqual(['x64']);
    expect(resolveArchitectures('armv6m', 'v1.24.1')).toEqual(['armv6m']);
    expect(resolveArchitectures('xtensawin', 'v1.24.1')).toEqual(['xtensawin']);
  });

  it('returns rv32imc when explicitly requested for supported versions', () => {
    expect(resolveArchitectures('rv32imc', 'v1.25.0')).toEqual(['rv32imc']);
  });

  it('handles pre-release versions correctly', () => {
    // Pre-release of 1.25.0 should include rv32imc
    const archs = resolveArchitectures('all', 'v1.25.0-preview.1');
    expect(archs).toContain('rv32imc');
    expect(archs).toEqual([...SINGLE_ARCHITECTURES]);

    // Pre-release of 1.24.x should exclude rv32imc
    const archs24 = resolveArchitectures('all', 'v1.24.0-preview');
    expect(archs24).not.toContain('rv32imc');
  });
});
