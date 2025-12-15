# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub Action to cross-compile MicroPython native modules (`.mpy` files) for all supported architectures (x64, x86, ARM variants, ESP8266/ESP32, RISC-V).

## Common Commands

```bash
npm install          # Install dependencies and setup husky hooks
npm run typecheck    # Type check TypeScript
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Prettier
npm run build        # Bundle with ncc to dist/
npm run all          # Run typecheck + lint + build + test
```

## Building

The action uses `@vercel/ncc` to bundle TypeScript into single JavaScript files:
- `dist/index.js` - Main action entry point
- `dist/post/index.js` - Post-step for cache saving

**Always commit `dist/` after changes** - GitHub Actions runs the compiled JavaScript directly.

## Architecture

### Two-Phase Execution Model

**Phase 1 (Sequential):** Input validation → Architecture resolution → Workarounds → Toolchain setup (stores PATH/env per architecture)

**Phase 2 (Parallel or Sequential):** For each MicroPython version, builds all architectures using isolated environments per `make` process.

### Key Source Files

- `src/index.ts` - Main entry point, orchestrates build flow
- `src/post.ts` - Post-step for saving caches
- `src/types.ts` - TypeScript interfaces, `VALID_ARCHITECTURES` constant
- `src/validation.ts` - Input validation logic
- `src/micropython.ts` - MicroPython setup (clone, build mpy-cross)
- `src/build/` - Make execution and workarounds
- `src/toolchains/` - Toolchain implementations (one file per architecture family)
- `src/cache/` - Cache restore/save logic

### Toolchain Pattern

Each toolchain extends `BaseToolchain` from `src/toolchains/base.ts` and implements:
- `setup()` - Install the toolchain
- `isAvailable()` - Check if already installed
- `getCacheConfig()` - Cache paths and keys
- `getPathAdditions()` - Directories to add to PATH
- `getEnvironment()` - Environment variables to set

### Adding a New Architecture

1. Create `src/toolchains/newarch.ts` extending `BaseToolchain`
2. Add case to factory in `src/toolchains/index.ts`
3. Add to `VALID_ARCHITECTURES` in `src/types.ts`
4. Add tests in `.github/workflows/test.yml`
5. Update `README.md` and `action.yml`

## Caching

Critical for slow toolchains. State passed between main and post steps via `core.saveState()`/`core.getState()`.

Approximate cache sizes and build times:

| Toolchain          | Cache Size      | First Build Time | Cached Build Time |
| ------------------ | --------------- | ---------------- | ----------------- |
| ARM (all variants) | ~400 MB         | ~5 min           | ~30 sec           |
| Xtensa (ESP8266)   | ~800 MB         | ~15 min          | ~1 min            |
| Xtensawin (ESP32)  | ~1 GB           | ~10 min          | ~1 min            |
| MicroPython        | ~200 MB/version | ~2 min           | ~30 sec           |
| x86/x64/rv32imc    | Not cached      | ~1-2 min         | ~1-2 min          |

All ARM variants (armv6m, armv7m, armv7emsp, armv7emdp) share the same cache to avoid redundant storage.

## Static Const Workaround

Automatically replaces `static const` with `const` to fix ESP32 garbage value issue (micropython#14429). Controlled by `static-const-workaround` input.

## Design Decisions & Rationale

This section documents deliberate design choices. **Do not revert these without understanding the rationale.**

### 1. Toolchain Paths Use `~/.mpy-toolchains/` (not `/opt/` or `/home/runner/`)

**File:** `src/constants.ts`

**Why:** Original hardcoded paths like `/home/runner/esp-idf` and `/opt/arm-none-eabi-gcc` only work on GitHub's ubuntu-latest runners. Using `os.homedir()` ensures cross-platform compatibility if the action ever runs on macOS or self-hosted runners. The `~/.mpy-toolchains/` directory keeps all toolchains organized in one location.

**Do not:** Revert to hardcoded `/home/runner/` or `/opt/` paths.

### 2. Centralized `CACHE_VERSION` in `constants.ts`

**File:** `src/constants.ts`

**Why:** Previously, `CACHE_VERSION` was defined in 4 different files (`base.ts`, `arm.ts`, `micropython.ts`, with different values). This made cache invalidation error-prone. A single constant ensures all caches invalidate together when the format changes.

**Do not:** Create local `CACHE_VERSION` constants in individual toolchain files.

### 3. Custom Timeout Implementation in `execCommand()`

**File:** `src/toolchains/base.ts`

**Why:** The `@actions/exec` library does NOT have a built-in timeout option. We implement timeout via `Promise.race()` with a rejection timer. This prevents toolchain builds from hanging indefinitely (xtensa can take 15+ minutes; if it hangs, GitHub would only kill it after 6 hours).

**Do not:** Try to use `timeout` directly in `exec.ExecOptions` - it doesn't exist and will cause TypeScript errors.

### 4. Static Const Workaround Skips Comments

**File:** `src/build/workarounds.ts`

**Why:** The original regex `/\bstatic\s+(const\b)/g` would incorrectly modify `// static const` comments and `/* static const */` blocks. The workaround now:
1. Creates a "stripped" version of the file with comments replaced by spaces
2. Checks if `static const` appears at the same position in both original and stripped content
3. Only modifies non-comment occurrences

This prevents corrupting documentation comments that mention `static const`.

**Do not:** Simplify back to a single regex replacement without comment awareness.

### 5. Parallel Build Job Calculation Divides CPUs

**File:** `src/build/make.ts`

**Why:** When `parallel-builds: 4` is set with 8 CPUs, running 4 concurrent `make -j8` commands would spawn 32 processes, causing severe resource contention. The fix:
```typescript
const makeJobs = Math.max(1, Math.floor(numCpus / concurrentBuilds));
```
With 4 parallel builds and 8 CPUs, each make uses `-j2`, for 8 total processes.

**Do not:** Remove the `concurrentBuilds` parameter or always use full CPU count.

### 6. `findMpyFile()` Prefers Expected Filename

**File:** `src/build/make.ts`

**Why:** If multiple `.mpy` files exist in the build directory, the function previously just returned the newest one. This could return the wrong file if build artifacts from a previous run remained. Now it first looks for a file matching `output-name` if specified, and only falls back to "newest file" if not found.

**Do not:** Remove the `expectedName` parameter or the preference logic.

### 7. ESP-IDF Version Format Validation

**File:** `src/validation.ts`

**Why:** ESP-IDF versions must be valid git tags (e.g., `v5.0.6`, `v5.2`). Without validation, a user passing `esp-idf-version: "latest"` would get a cryptic git clone error. The regex `/^v?\d+\.\d+(\.\d+)?$/` catches invalid formats early with a clear error message.

**Do not:** Remove this validation - it prevents confusing downstream errors.

### 8. ARM Toolchain Uses `fs.renameSync()` Instead of `sudo mv`

**File:** `src/toolchains/arm.ts`

**Why:** The original code used `sudo mv` to rename the extracted ARM toolchain directory. This required sudo privileges and was Linux-specific. Using `fs.renameSync()` is cross-platform and doesn't require elevated permissions since we now extract to a user-writable directory (`~/.mpy-toolchains/`).

**Do not:** Revert to `sudo mv` - it's unnecessary and less portable.

### 9. Toolchains Create Parent Directories

**Files:** `src/toolchains/arm.ts`, `src/toolchains/xtensa.ts`, `src/toolchains/xtensawin.ts`

**Why:** Since toolchains now install to `~/.mpy-toolchains/`, the parent directory may not exist on a fresh runner. Each toolchain's `setup()` method now calls `fs.mkdirSync(parentDir, { recursive: true })` before cloning/extracting.

**Do not:** Remove these `mkdirSync` calls - they're required for the new path structure.
