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
  isMicropythonReleaseVersion,
  targetSupportsRv32imc,
} from './mpy-versions';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Resolve architectures for the given build targets.
 * rv32imc is included only if at least one target supports it (mpy 6.3+ AND
 * MicroPython >= 1.25.0); targets that don't support it are filtered again
 * per-build at runtime.
 */
export function resolveArchitectures(
  architecture: Architecture,
  buildTargets: BuildTarget[]
): SingleArchitecture[] {
  if (architecture === 'all') {
    const archs = [...SINGLE_ARCHITECTURES];
    if (!buildTargets.some(targetSupportsRv32imc)) {
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

  // Determine build targets
  const buildTargets: BuildTarget[] = [];

  const micropythonVersions = micropythonVersionInput
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const isRefMode =
    micropythonVersions.length > 0 && !micropythonVersions.every(isMicropythonReleaseVersion);

  if (isRefMode) {
    // Git ref mode: micropython-version is a branch or commit SHA (e.g. for
    // testing a fork). The resulting MPY subversion cannot be derived from a
    // ref, so the user must declare it via mpy-version.
    if (micropythonVersions.length > 1) {
      throw new ValidationError(
        `micropython-version "${micropythonVersionInput}" contains a git ref (branch or commit SHA); git refs cannot be combined with other versions.`
      );
    }
    const ref = micropythonVersions[0];

    if (!/^[\w./-]+$/.test(ref) || ref.startsWith('-')) {
      throw new ValidationError(
        `Invalid micropython-version "${ref}". Expected a release version (e.g. v1.22.2) or a git ref (branch name or commit SHA).`
      );
    }

    const mpyVersions = mpyVersionInput
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (mpyVersions.length !== 1 || !VALID_MPY_VERSIONS.includes(mpyVersions[0] as MpyVersion)) {
      throw new ValidationError(
        `micropython-version "${ref}" is a git ref, so the resulting MPY subversion cannot be derived; set mpy-version to exactly one of: ${VALID_MPY_VERSIONS.join(', ')} (e.g. mpy-version: 6.3).`
      );
    }

    buildTargets.push({
      mpyVersion: mpyVersions[0],
      micropythonVersion: ref,
    });
  } else if (micropythonVersions.length > 0) {
    // Power user mode: raw micropython-version release versions, mutually
    // exclusive with mpy-version
    if (mpyVersionInput) {
      throw new ValidationError(
        'Cannot specify both mpy-version and micropython-version. Use one or the other.'
      );
    }

    // Create build targets from raw versions (deduplicating exact repeats).
    // Distinct MicroPython versions producing the same mpy subversion are
    // rejected: output filenames embed only the subversion, so those builds
    // would silently overwrite each other.
    const seenMpyVersions = new Map<string, string>();
    for (const version of micropythonVersions) {
      const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
      const mpyVersion = deriveMpyVersionFromMicropython(normalizedVersion);
      const existing = seenMpyVersions.get(mpyVersion);
      if (existing === normalizedVersion) {
        continue;
      }
      if (existing) {
        throw new ValidationError(
          `micropython-version values ${existing} and ${normalizedVersion} both produce mpy ${mpyVersion}, so their output filenames would collide. Specify at most one MicroPython version per mpy subversion.`
        );
      }
      seenMpyVersions.set(mpyVersion, normalizedVersion);
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
      if (!targetSupportsRv32imc(target)) {
        throw new ValidationError(
          `Architecture rv32imc requires mpy 6.3+ (MicroPython >= 1.25.0), but mpy ${target.mpyVersion} (${target.micropythonVersion}) was requested`
        );
      }
    }
  }

  // Resolve the list of architectures to build
  const architectures = resolveArchitectures(architecture as Architecture, buildTargets);

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
