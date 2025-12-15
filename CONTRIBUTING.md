# Contributing

## Development Setup

```bash
# Install dependencies (also sets up pre-commit hooks via husky)
npm install

# Type check
npm run typecheck

# Lint
npm run lint
npm run lint:fix  # Auto-fix issues

# Format
npm run format        # Format all files
npm run format:check  # Check formatting

# Build
npm run build

# Run all checks (typecheck + lint + build + test)
npm run all
```

## Code Quality

This project uses:

- **ESLint** - TypeScript linting (`eslint.config.mjs`)
- **Prettier** - Code formatting (`.prettierrc`)
- **Husky** - Git hooks
- **lint-staged** - Run linters on staged files only

Pre-commit hooks automatically run ESLint and Prettier on staged `.ts` files. To skip hooks (not recommended):

```bash
git commit --no-verify
```

## Project Structure

```
├── action.yml              # Action metadata and inputs/outputs
├── eslint.config.mjs       # ESLint configuration
├── .prettierrc             # Prettier configuration
├── .husky/                 # Git hooks
│   └── pre-commit          # Runs lint-staged
├── src/
│   ├── index.ts            # Main entry point
│   ├── post.ts             # Post-step for cache saving
│   ├── types.ts            # TypeScript interfaces
│   ├── validation.ts       # Input validation
│   ├── micropython.ts      # MicroPython setup (clone, build mpy-cross)
│   ├── cache/
│   │   └── index.ts        # Cache restore/save logic
│   ├── build/
│   │   ├── index.ts
│   │   ├── make.ts         # Make execution
│   │   └── workarounds.ts  # Static const workaround
│   └── toolchains/
│       ├── index.ts        # Toolchain factory
│       ├── base.ts         # Base toolchain class
│       ├── x86.ts          # x86/x64
│       ├── arm.ts          # ARM variants
│       ├── xtensa.ts       # ESP8266
│       ├── xtensawin.ts    # ESP32
│       └── rv32imc.ts      # RISC-V
├── dist/                   # Compiled output (committed)
├── test-fixtures/          # Test native module
└── .github/workflows/      # CI tests
```

## How It Works

### Execution Flow (Two-Phase Architecture)

The action uses a two-phase approach to enable parallel builds:

**Phase 1: Sequential Setup**
1. **Validate inputs** - Check architecture, version format, source directory
2. **Resolve architectures** - If `all`, expand to list (excluding `rv32imc` if MicroPython < 1.25.0)
3. **Apply workarounds** - Fix `static const` issue if enabled (once, before builds)
4. **Setup all toolchains** - Install each toolchain sequentially, storing PATH/env config

**Phase 2: Builds (Parallel or Sequential)**
5. **For each MicroPython version:**
   - Setup MicroPython (clone repo, build `mpy-cross`, set `MPY_DIR`)
   - Build all architectures (parallel if `parallel-builds > 0`, otherwise sequential)
   - Each build runs `make` with isolated environment (toolchain-specific PATH/env)
   - Copy outputs to `dist/` with architecture suffix
6. **Set outputs** - Paths to `.mpy` files, summary of results

### Parallel Build Implementation

When `parallel-builds > 0`, builds run concurrently using a worker pool pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Setup toolchains (sequential)                      │
│   x64 → armv7m → xtensa → xtensawin → ...                  │
│   Store: { arch → { pathAdditions, environment } }          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Parallel builds (per MicroPython version)          │
│                                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│   │ Worker 1 │ │ Worker 2 │ │ Worker 3 │ │ Worker 4 │      │
│   │  x64     │ │  armv7m  │ │  xtensa  │ │xtensawin │      │
│   │(env: A)  │ │(env: B)  │ │(env: C)  │ │(env: D)  │      │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

Key design decisions:
- **Toolchain setup is sequential** - Avoids apt conflicts and resource contention
- **Builds use isolated environments** - Each `make` process gets its own PATH/env via `exec.exec()` options
- **No global PATH/env modification** - Unlike sequential mode, parallel mode doesn't use `core.addPath()`/`core.exportVariable()`

### Caching Strategy

Caching is critical for xtensa (~15 min build) and xtensawin (~10 min setup).

| Component | Cache Key | Paths |
|-----------|-----------|-------|
| MicroPython | `micropython-v2-{version}` | `~/micropython` |
| ARM toolchain | `build-mpy-...-armv*-{toolchain-version}` | `/opt/arm-none-eabi-gcc` |
| Xtensa (ESP8266) | `build-mpy-...-xtensa-{repo-hash}` | `~/esp-open-sdk` |
| Xtensawin (ESP32) | `build-mpy-...-xtensawin-{idf-version}` | `~/esp-idf`, `~/.espressif` |

The post-step (`post.ts`) saves caches after the main action completes. State is passed via `core.saveState()`/`core.getState()`.

### Toolchain Implementations

Each toolchain extends `BaseToolchain` and implements:

```typescript
interface Toolchain {
  setup(): Promise<void>;           // Install the toolchain
  isAvailable(): Promise<boolean>;  // Check if already installed
  getCacheConfig(): CacheConfig;    // Cache paths and keys
  getPathAdditions(): string[];     // Directories to add to PATH
  getEnvironment(): Record<string, string>;  // Env vars to set
}
```

**x86/x64** - Just `apt-get install gcc-multilib`

**ARM** - Downloads ARM GNU Toolchain from arm.com, extracts to `/opt`

**Xtensa (ESP8266)** - Clones and builds `esp-open-sdk` from source. This is slow (~15 min) so caching is essential.

**Xtensawin (ESP32)** - Clones ESP-IDF, runs `install.sh`, captures environment variables from `export.sh`.

**rv32imc** - `apt-get install gcc-riscv64-unknown-elf picolibc-riscv64-unknown-elf`

## Adding a New Architecture

1. Create `src/toolchains/newarch.ts`:

```typescript
import { BaseToolchain } from './base';
import { Architecture } from '../types';

export class NewArchToolchain extends BaseToolchain {
  readonly name = 'newarch';
  readonly architecture: Architecture = 'newarch';

  async setup(): Promise<void> {
    // Install toolchain
  }

  getCacheConfig() {
    return {
      architecture: this.architecture,
      cachePaths: ['/path/to/toolchain'],
      cacheKey: this.generateCacheKey('version'),
      restoreKeys: this.generateRestoreKeys(),
    };
  }

  getPathAdditions(): string[] {
    return ['/path/to/toolchain/bin'];
  }
}
```

2. Add to `src/toolchains/index.ts`:

```typescript
case 'newarch':
  return new NewArchToolchain();
```

3. Add to `src/types.ts`:

```typescript
export const VALID_ARCHITECTURES = [
  // ...existing...
  'newarch',
] as const;
```

4. Add tests in `.github/workflows/test.yml`

5. Update `README.md` and `action.yml`

## Static Const Workaround

On ESP32, `static const` variables in native modules return garbage values ([micropython#14429](https://github.com/micropython/micropython/issues/14429)). The workaround replaces `static const` with `const` in source files before building.

The regex `/\bstatic\s+(const\b)/g` matches `static const` and replaces with captured group `$1` (just `const`).

This is enabled by default but can be disabled via `static-const-workaround: false`.

## Testing

The CI workflow tests:

- **Quick tests** - x64, x86, rv32imc (fast toolchains)
- **ARM tests** - All ARM variants
- **Xtensa test** - ESP8266 (slow, separate job)
- **Xtensawin test** - ESP32 (slow, separate job)
- **Version tests** - Multiple MicroPython versions
- **Cache tests** - Verify caching behavior

Run locally with [act](https://github.com/nektos/act):

```bash
act -j test-quick
```

## Building the Action

The action uses [@vercel/ncc](https://github.com/vercel/ncc) to bundle TypeScript into single JavaScript files:

```bash
npm run build
```

This creates:
- `dist/index.js` - Main action
- `dist/post/index.js` - Post-step

**Always commit `dist/` after changes** - GitHub Actions runs the compiled JavaScript directly.

## Release Process

1. Update version in `package.json`
2. Run `npm run build`
3. Commit changes including `dist/`
4. Tag release: `git tag v1.x.x && git push --tags`
5. Update `v1` tag: `git tag -f v1 && git push -f origin v1`
