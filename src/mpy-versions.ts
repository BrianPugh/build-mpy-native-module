/**
 * Mapping of MPY subversions to recommended MicroPython versions.
 *
 * Users should build using the most recent MicroPython version that produces
 * each MPY subversion, as newer versions contain bugfixes and optimizations.
 *
 * See: https://docs.micropython.org/en/latest/reference/mpyfiles.html#versioning-and-compatibility-of-mpy-files
 */

/**
 * MPY subversion to recommended MicroPython version mapping.
 *
 * | MPY Version | MicroPython Range | Recommended |
 * |-------------|-------------------|-------------|
 * | 6.3         | v1.23.0+          | v1.27.0     |
 * | 6.2         | v1.22.x           | v1.22.2     |
 * | 6.1         | v1.20-v1.21.0     | v1.21.0     |
 * | 6           | v1.19.x           | v1.19.1     |
 * | 5           | v1.12-v1.18       | v1.18       |
 */
export const MPY_VERSION_MAP: Record<string, string> = {
  '6.3': 'v1.27.0',
  '6.2': 'v1.22.2',
  '6.1': 'v1.21.0',
  '6': 'v1.19.1',
  '5': 'v1.18',
} as const;

export const VALID_MPY_VERSIONS = ['6.3', '6.2', '6.1', '6', '5'] as const;

export type MpyVersion = (typeof VALID_MPY_VERSIONS)[number];

/**
 * MPY subversions that support rv32imc architecture.
 * rv32imc requires MicroPython >= 1.25.0
 */
export const MPY_VERSIONS_WITH_RV32IMC: MpyVersion[] = ['6.3'];

/**
 * Get the recommended MicroPython version for an MPY subversion.
 */
export function getMicroPythonVersionForMpy(mpyVersion: MpyVersion): string {
  return MPY_VERSION_MAP[mpyVersion];
}

/**
 * Check if an MPY version supports rv32imc architecture.
 */
export function mpyVersionSupportsRv32imc(mpyVersion: MpyVersion): boolean {
  return MPY_VERSIONS_WITH_RV32IMC.includes(mpyVersion);
}

/**
 * Check if a raw MicroPython version supports rv32imc architecture.
 * rv32imc requires MicroPython >= 1.25.0
 */
export function micropythonVersionSupportsRv32imc(micropythonVersion: string): boolean {
  const normalizedVersion = micropythonVersion.replace(/^v/, '').split('-')[0];
  const [major, minor] = normalizedVersion.split('.').map(Number);
  return major > 1 || (major === 1 && minor >= 25);
}
