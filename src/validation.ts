import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  Config,
  Architecture,
  SingleArchitecture,
  VALID_ARCHITECTURES,
  SINGLE_ARCHITECTURES,
} from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function supportsRv32imc(micropythonVersion: string): boolean {
  // Remove 'v' prefix and pre-release suffix (e.g., v1.25.0-preview.1 -> 1.25.0)
  const normalizedVersion = micropythonVersion.replace(/^v/, '').split('-')[0];
  const [major, minor] = normalizedVersion.split('.').map(Number);
  return major > 1 || (major === 1 && minor >= 25);
}

export function resolveArchitectures(
  architecture: Architecture,
  micropythonVersion: string
): SingleArchitecture[] {
  if (architecture === 'all') {
    // Build all architectures, excluding rv32imc if MicroPython < 1.25.0
    const archs = [...SINGLE_ARCHITECTURES];
    if (!supportsRv32imc(micropythonVersion)) {
      return archs.filter((a) => a !== 'rv32imc');
    }
    return archs;
  }
  return [architecture];
}

export function validateInputs(): Config {
  // Architecture (optional, defaults to 'all')
  const architecture = (core.getInput('architecture') || 'all') as string;
  if (!VALID_ARCHITECTURES.includes(architecture as Architecture)) {
    throw new ValidationError(
      `Invalid architecture "${architecture}". Valid options: ${VALID_ARCHITECTURES.join(', ')}`
    );
  }

  // MicroPython version(s) (required) - single value or YAML list
  const micropythonVersions = core.getMultilineInput('micropython-version', {
    required: true,
  });

  if (micropythonVersions.length === 0) {
    throw new ValidationError('micropython-version is required');
  }

  // Validate each version format (supports pre-release versions like v1.25.0-preview.1)
  for (const version of micropythonVersions) {
    if (!version.match(/^v?\d+\.\d+\.\d+(-[\w.]+)?$/)) {
      throw new ValidationError(
        `Invalid micropython-version format "${version}". Expected format: v1.22.2, 1.22.2, or v1.25.0-preview.1`
      );
    }
  }

  // rv32imc requires MicroPython >= 1.25.0 (only check for single arch)
  if (architecture === 'rv32imc') {
    for (const version of micropythonVersions) {
      if (!supportsRv32imc(version)) {
        throw new ValidationError(
          `Architecture rv32imc requires MicroPython >= 1.25.0, got ${version}`
        );
      }
    }
  }

  // Resolve the list of architectures to build (use lowest version for exclusions)
  // Sort versions and use the lowest to determine architecture compatibility
  const sortedVersions = [...micropythonVersions].sort((a, b) => {
    // Remove 'v' prefix and split off pre-release suffix
    const parseVersion = (v: string) => {
      const normalized = v.replace(/^v/, '');
      const [versionPart, prerelease] = normalized.split('-');
      const [major, minor, patch] = versionPart.split('.').map(Number);
      return { major, minor, patch, prerelease };
    };
    const av = parseVersion(a);
    const bv = parseVersion(b);
    if (av.major !== bv.major) return av.major - bv.major;
    if (av.minor !== bv.minor) return av.minor - bv.minor;
    if (av.patch !== bv.patch) return av.patch - bv.patch;
    // Pre-release versions sort before release versions (e.g., 1.25.0-preview < 1.25.0)
    if (av.prerelease && !bv.prerelease) return -1;
    if (!av.prerelease && bv.prerelease) return 1;
    // Both have prerelease, compare alphabetically
    if (av.prerelease && bv.prerelease) return av.prerelease.localeCompare(bv.prerelease);
    return 0;
  });
  const highestVersion = sortedVersions[sortedVersions.length - 1];

  const architectures = resolveArchitectures(architecture as Architecture, highestVersion);

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
    micropythonVersions,
    micropythonRepo,
    sourceDir,
    outputName,
    makeTarget,
    makeArgs,
    staticConstWorkaround,
    workaroundPatterns,
    cacheToolchains,
    espIdfVersion,
    espOpenSdkRepo,
    espOpenSdkBranch,
    parallelBuilds,
  };
}
