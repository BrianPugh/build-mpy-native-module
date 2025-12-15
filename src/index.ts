import * as core from '@actions/core';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { validateInputs, ValidationError, supportsRv32imc } from './validation';
import { createToolchain } from './toolchains';
import { ToolchainCache } from './cache';
import { setupMicroPython, getMicroPythonMajorMinor } from './micropython';
import { runMake, cleanupBuildDir } from './build';
import { SingleArchitecture, Config, ToolchainEnv } from './types';
import { parallelMap } from './utils';

interface BuildResult {
  architecture: SingleArchitecture;
  micropythonVersion: string;
  mpyFile: string;
  success: boolean;
  error?: string;
}

interface ToolchainSetupResult {
  architecture: SingleArchitecture;
  env: ToolchainEnv;
  cacheHit: boolean;
}

function getArchitecturesForVersion(
  requestedArchitectures: SingleArchitecture[],
  micropythonVersion: string
): SingleArchitecture[] {
  if (!supportsRv32imc(micropythonVersion)) {
    return requestedArchitectures.filter((a) => a !== 'rv32imc');
  }
  return requestedArchitectures;
}

/**
 * Setup a single toolchain and return its environment configuration.
 * Does NOT modify global PATH/env - stores config for later use.
 */
async function setupToolchain(
  architecture: SingleArchitecture,
  config: Config
): Promise<ToolchainSetupResult> {
  core.info(`Setting up ${architecture} toolchain...`);
  const toolchain = createToolchain(architecture, config);

  let cacheHit = false;

  if (config.cacheToolchains) {
    const cacheConfig = toolchain.getCacheConfig();

    if (cacheConfig.cacheKey && cacheConfig.cachePaths.length > 0) {
      const cache = new ToolchainCache(cacheConfig);
      const restored = await cache.restore();

      if (restored && (await toolchain.isAvailable())) {
        core.info(`  ${architecture}: Restored from cache`);
        cacheHit = cache.getCacheHit();
      } else {
        core.info(`  ${architecture}: Setting up from scratch...`);
        await toolchain.setup();
      }

      // Save state for post step cache saving
      core.saveState(`toolchain-cache-key-${architecture}`, cacheConfig.cacheKey);
      core.saveState(
        `toolchain-cache-paths-${architecture}`,
        JSON.stringify(cacheConfig.cachePaths)
      );
      core.saveState(`toolchain-cache-hit-${architecture}`, cacheHit.toString());
    } else {
      await toolchain.setup();
    }
  } else {
    await toolchain.setup();
  }

  return {
    architecture,
    env: {
      pathAdditions: toolchain.getPathAdditions(),
      environment: toolchain.getEnvironment(),
    },
    cacheHit,
  };
}

/**
 * Build for a single architecture using the provided toolchain environment.
 */
async function buildForArchitecture(
  architecture: SingleArchitecture,
  micropythonVersion: string,
  config: Config,
  toolchainEnv: ToolchainEnv,
  outputDir: string,
  concurrentBuilds: number = 1
): Promise<BuildResult> {
  const mpyMajorMinor = getMicroPythonMajorMinor(micropythonVersion);

  core.info(`Building: ${architecture} / MicroPython ${micropythonVersion}`);

  let buildDir: string | undefined;
  try {
    const buildResult = await runMake({
      config: {
        ...config,
        architecture,
        architectures: [architecture],
        micropythonVersions: [micropythonVersion],
      },
      toolchainEnv,
      concurrentBuilds,
    });
    buildDir = buildResult.buildDir;

    // Copy the built file to output directory with version and architecture suffix
    const ext = path.extname(buildResult.mpyFile);
    const baseName = path.basename(buildResult.mpyFile, ext);
    const outputFileName = `${baseName}-mpy${mpyMajorMinor}-${architecture}${ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    fs.copyFileSync(buildResult.mpyFile, outputPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex');
    core.info(`  Output: ${outputPath}`);
    core.info(`  SHA256: ${hash}`);

    // Clean up isolated build directory now that the file is copied
    cleanupBuildDir(buildDir);

    return {
      architecture,
      micropythonVersion,
      mpyFile: outputPath,
      success: true,
    };
  } catch (error) {
    // Clean up on error too
    cleanupBuildDir(buildDir);
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(
      `Failed to build ${architecture} for MicroPython ${micropythonVersion}: ${errorMessage}`
    );
    return {
      architecture,
      micropythonVersion,
      mpyFile: '',
      success: false,
      error: errorMessage,
    };
  }
}

async function run(): Promise<void> {
  try {
    // 1. Validate inputs
    core.info('Validating inputs...');
    const config = validateInputs();
    core.info(`Architecture: ${config.architecture}`);
    core.info(`MicroPython versions: ${config.micropythonVersions.join(', ')}`);
    core.info(`Source directory: ${config.sourceDir}`);
    core.info(
      `Parallel builds: ${config.parallelBuilds === 0 ? 'disabled (sequential)' : config.parallelBuilds}`
    );
    if (config.staticConstWorkaround) {
      core.info('Static const workaround: enabled (applied to build copies, not source)');
    }

    // 2. Create output directory
    const outputDir = path.join(config.sourceDir, 'dist');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 3. Phase 1: Setup all unique toolchains
    core.startGroup('Phase 1: Setting up toolchains');
    const toolchainEnvs = new Map<SingleArchitecture, ToolchainEnv>();
    let anyToolchainCacheHit = false;

    for (const architecture of config.architectures) {
      const result = await setupToolchain(architecture, config);
      toolchainEnvs.set(architecture, result.env);
      if (result.cacheHit) {
        anyToolchainCacheHit = true;
      }
    }
    core.info(`Toolchains ready: ${config.architectures.join(', ')}`);
    core.endGroup();

    // Set toolchain cache hit output
    core.setOutput('toolchain-cache-hit', anyToolchainCacheHit.toString());

    // 4. Phase 2: Build for each MicroPython version
    const allResults: BuildResult[] = [];

    for (const micropythonVersion of config.micropythonVersions) {
      core.info('');
      core.info('='.repeat(60));
      core.info(`MicroPython ${micropythonVersion}`);
      core.info('='.repeat(60));

      // Setup MicroPython for this version
      core.startGroup(`Setting up MicroPython ${micropythonVersion}`);
      await setupMicroPython(micropythonVersion, config.micropythonRepo);
      core.endGroup();

      // Get architectures for this version (may exclude rv32imc for older versions)
      const architecturesForVersion = getArchitecturesForVersion(
        config.architectures,
        micropythonVersion
      );

      if (architecturesForVersion.length < config.architectures.length) {
        const skipped = config.architectures.filter((a) => !architecturesForVersion.includes(a));
        core.info(
          `Skipping architectures not supported by ${micropythonVersion}: ${skipped.join(', ')}`
        );
      }

      // Build for all architectures (parallel or sequential)
      if (config.parallelBuilds > 0 && architecturesForVersion.length > 1) {
        const effectiveConcurrency = Math.min(
          config.parallelBuilds,
          architecturesForVersion.length
        );
        core.info(
          `Building ${architecturesForVersion.length} architectures in parallel (max ${effectiveConcurrency} concurrent)...`
        );

        const results = await parallelMap(
          architecturesForVersion,
          config.parallelBuilds,
          async (architecture) => {
            const toolchainEnv = toolchainEnvs.get(architecture)!;
            return buildForArchitecture(
              architecture,
              micropythonVersion,
              config,
              toolchainEnv,
              outputDir,
              effectiveConcurrency
            );
          }
        );

        allResults.push(...results);
      } else {
        // Sequential builds
        core.info(`Building for architectures: ${architecturesForVersion.join(', ')}`);

        for (const architecture of architecturesForVersion) {
          const toolchainEnv = toolchainEnvs.get(architecture)!;
          const result = await buildForArchitecture(
            architecture,
            micropythonVersion,
            config,
            toolchainEnv,
            outputDir,
            1 // Sequential, one build at a time
          );
          allResults.push(result);
        }
      }
    }

    // 5. Summarize results
    const successful = allResults.filter((r) => r.success);
    const failed = allResults.filter((r) => !r.success);

    core.info('');
    core.info('='.repeat(60));
    core.info('Build Summary');
    core.info('='.repeat(60));
    core.info(`Successful: ${successful.length}/${allResults.length}`);

    if (successful.length > 0) {
      core.info('');
      core.info('Built files:');
      for (const r of successful) {
        core.info(`  - ${r.mpyFile}`);
      }
    }

    if (failed.length > 0) {
      core.info('');
      core.warning('Failed builds:');
      for (const r of failed) {
        core.warning(`  - ${r.architecture} (mpy ${r.micropythonVersion}): ${r.error}`);
      }
    }

    // 6. Set outputs
    const mpyFiles = successful.map((r) => r.mpyFile);
    const architecturesBuilt = [...new Set(successful.map((r) => r.architecture))];
    const versionsBuilt = [...new Set(successful.map((r) => r.micropythonVersion))];

    // For single architecture + single version, output the single file path
    // Otherwise, output the directory
    if (
      config.architectures.length === 1 &&
      config.micropythonVersions.length === 1 &&
      successful.length === 1
    ) {
      core.setOutput('mpy-file', successful[0].mpyFile);
    } else {
      core.setOutput('mpy-file', outputDir);
    }

    core.setOutput('mpy-files', JSON.stringify(mpyFiles));
    core.setOutput('output-dir', outputDir);
    core.setOutput('mpy-dir', process.env.MPY_DIR || '');
    core.setOutput('architecture', config.architecture);
    core.setOutput('architectures', JSON.stringify(architecturesBuilt));
    core.setOutput('micropython-versions', JSON.stringify(versionsBuilt));

    // Fail if any builds failed
    if (failed.length > 0) {
      core.setFailed(
        `${failed.length} build(s) failed: ${failed.map((r) => `${r.architecture}@${r.micropythonVersion}`).join(', ')}`
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      core.setFailed(`Validation error: ${error.message}`);
    } else if (error instanceof Error) {
      core.setFailed(`Build failed: ${error.message}`);
      if (error.stack) {
        core.debug(error.stack);
      }
    } else {
      core.setFailed(`Build failed: ${String(error)}`);
    }
  }
}

run();
