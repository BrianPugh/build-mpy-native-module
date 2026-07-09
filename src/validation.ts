import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  Config,
  Architecture,
  SingleArchitecture,
  BuildTarget,
  VALID_ARCHITECTURES,
  SINGLE_ARCHITECTURES,
} from './types';
import {
  VALID_MPY_VERSIONS,
  MpyVersion,
  MPY_VERSION_MAP,
  mpyVersionSupportsRv32imc,
} from './mpy-versions';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Resolve architectures for a given MPY version.
 * rv32imc is only supported on mpy 6.3+ (MicroPython >= 1.25.0)
 */
export function resolveArchitecturesForMpy(
  architecture: Architecture,
  mpyVersion: string
): SingleArchitecture[] {
  if (architecture === 'all') {
    const archs = [...SINGLE_ARCHITECTURES];
    if (!mpyVersionSupportsRv32imc(mpyVersion as MpyVersion)) {
      return archs.filter((a) => a !== 'rv32imc');
    }
    return archs;
  }
  return [architecture];
}

/**
 * Derive MPY version from a MicroPython version string.
 * Used when user specifies raw micropython-version.
 * Throws ValidationError for versions older than v1.12 (mpy < 5).
 */
function deriveMpyVersionFromMicropython(micropythonVersion: string): MpyVersion {
  const normalized = micropythonVersion.replace(/^v/, '').split('-')[0];
  const [major, minor] = normalized.split('.').map(Number);

  if (major !== 1) {
    // Future-proof: assume mpy 6.3+ for major > 1
    return '6.3';
  }

  if (minor >= 23) return '6.3';
  if (minor === 22) return '6.2';
  if (minor >= 20 && minor <= 21) return '6.1';
  if (minor === 19) return '6';
  if (minor >= 12 && minor <= 18) return '5';

  // Versions older than v1.12 are not supported
  throw new ValidationError(
    `MicroPython ${micropythonVersion} is too old. This action requires MicroPython >= v1.12 (mpy version 5+).`
  );
}

export function validateInputs(): Config {
  // Architecture (optional, defaults to 'all')
  const architecture = (core.getInput('architecture') || 'all') as string;
  if (!VALID_ARCHITECTURES.includes(architecture as Architecture)) {
    throw new ValidationError(
      `Invalid architecture "${architecture}". Valid options: ${VALID_ARCHITECTURES.join(', ')}`
    );
  }

  // Parse mpy-version input
  const mpyVersionInput = core.getInput('mpy-version') || '';
  const micropythonVersionInput = core.getInput('micropython-version') || '';

  // Check for mutually exclusive inputs
  if (mpyVersionInput && micropythonVersionInput) {
    throw new ValidationError(
      'Cannot specify both mpy-version and micropython-version. Use one or the other.'
    );
  }

  // Determine build targets
  const buildTargets: BuildTarget[] = [];

  if (micropythonVersionInput) {
    // Power user mode: using raw micropython-version

    const micropythonVersions = micropythonVersionInput
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    // Validate each version format
    for (const version of micropythonVersions) {
      if (!version.match(/^v?\d+\.\d+\.\d+(-[\w.]+)?$/)) {
        throw new ValidationError(
          `Invalid micropython-version format "${version}". Expected format: v1.22.2, 1.22.2, or v1.25.0-preview.1`
        );
      }
    }

    // Create build targets from raw versions
    for (const version of micropythonVersions) {
      const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
      const mpyVersion = deriveMpyVersionFromMicropython(normalizedVersion);
      buildTargets.push({
        mpyVersion,
        micropythonVersion: normalizedVersion,
      });
    }
  } else {
    // Normal mode: using mpy-version (default: 6.3)
    const mpyVersions = (mpyVersionInput || '6.3')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    // Handle 'all' special value
    const resolvedMpyVersions: MpyVersion[] = [];
    for (const v of mpyVersions) {
      if (v === 'all') {
        resolvedMpyVersions.push(...VALID_MPY_VERSIONS);
      } else if (VALID_MPY_VERSIONS.includes(v as MpyVersion)) {
        resolvedMpyVersions.push(v as MpyVersion);
      } else {
        throw new ValidationError(
          `Invalid mpy-version "${v}". Valid options: ${VALID_MPY_VERSIONS.join(', ')}, all`
        );
      }
    }

    // Remove duplicates and create build targets
    const uniqueMpyVersions = [...new Set(resolvedMpyVersions)];
    for (const mpyVersion of uniqueMpyVersions) {
      buildTargets.push({
        mpyVersion,
        micropythonVersion: MPY_VERSION_MAP[mpyVersion],
      });
    }
  }

  if (buildTargets.length === 0) {
    throw new ValidationError('No build targets specified');
  }

  // rv32imc validation - check if any build target doesn't support it
  if (architecture === 'rv32imc') {
    for (const target of buildTargets) {
      if (!mpyVersionSupportsRv32imc(target.mpyVersion as MpyVersion)) {
        throw new ValidationError(
          `Architecture rv32imc requires mpy 6.3+ (MicroPython >= 1.25.0), but mpy ${target.mpyVersion} was requested`
        );
      }
    }
  }

  // Resolve the list of architectures to build
  // Use the highest mpy version to determine the max architecture set
  const sortedTargets = [...buildTargets].sort((a, b) => {
    // Sort by mpy version descending (6.3 > 6.2 > 6.1 > 6 > 5)
    const aNum = parseFloat(a.mpyVersion);
    const bNum = parseFloat(b.mpyVersion);
    return bNum - aNum;
  });
  const highestMpyVersion = sortedTargets[0].mpyVersion;
  const architectures = resolveArchitecturesForMpy(architecture as Architecture, highestMpyVersion);

  // Source directory
  const sourceDir = path.resolve(core.getInput('source-dir') || '.');
  if (!fs.existsSync(sourceDir)) {
    throw new ValidationError(`Source directory does not exist: ${sourceDir}`);
  }
  const makefilePath = path.join(sourceDir, 'Makefile');
  if (!fs.existsSync(makefilePath)) {
    throw new ValidationError(`No Makefile found in source directory: ${sourceDir}`);
  }

  // Other inputs
  const outputName = core.getInput('output-name') || '';
  const makeTarget = core.getInput('make-target') || '';
  const makeArgs = core.getInput('make-args') || '';
  const mpyCrossArgs = core.getInput('mpy-cross-args') || '';
  const staticConstWorkaround = core.getInput('static-const-workaround') === 'true';
  const workaroundPatterns = (core.getInput('static-const-workaround-patterns') || '**/*.c,**/*.h')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const cacheToolchains = core.getInput('cache-toolchains') !== 'false';

  // ESP-IDF version (validate format)
  const espIdfVersion = core.getInput('esp-idf-version') || 'v5.0.6';
  if (!espIdfVersion.match(/^v?\d+\.\d+(\.\d+)?$/)) {
    throw new ValidationError(
      `Invalid esp-idf-version format "${espIdfVersion}". Expected format: v5.0.6 or v5.2`
    );
  }
  const espOpenSdkRepo =
    core.getInput('esp-open-sdk-repo') || 'https://github.com/BrianPugh/esp-open-sdk.git';
  const espOpenSdkBranch = core.getInput('esp-open-sdk-branch') || 'fix-ubuntu-21.10-build';

  // MicroPython repository
  const micropythonRepo =
    core.getInput('micropython-repo') || 'https://github.com/micropython/micropython';

  // Parallel builds (0 = sequential, 1-9 = max concurrent)
  const parallelBuildsInput = core.getInput('parallel-builds') || '4';
  const parallelBuilds = parseInt(parallelBuildsInput, 10);
  if (isNaN(parallelBuilds) || parallelBuilds < 0 || parallelBuilds > 9) {
    throw new ValidationError(
      `Invalid parallel-builds "${parallelBuildsInput}". Must be 0-9 (0 = sequential).`
    );
  }

  return {
    architecture: architecture as Architecture,
    architectures,
    buildTargets,
    micropythonRepo,
    sourceDir,
    outputName,
    makeTarget,
    makeArgs,
    mpyCrossArgs,
    staticConstWorkaround,
    workaroundPatterns,
    cacheToolchains,
    espIdfVersion,
    espOpenSdkRepo,
    espOpenSdkBranch,
    parallelBuilds,
  };
}
