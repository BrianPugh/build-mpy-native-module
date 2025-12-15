WARNING: THIS REPO IS NOT YET READY FOR USE.

# Build MicroPython Native Module

A GitHub Action to cross-compile MicroPython native modules (`.mpy` files) for all supported architectures.

## Supported Architectures

| Architecture | Target                              | Toolchain               |
| ------------ | ----------------------------------- | ----------------------- |
| `x64`        | Desktop/Server (64-bit)             | System GCC              |
| `x86`        | Desktop/Server (32-bit)             | gcc-multilib            |
| `armv6m`     | Cortex-M0/M0+ (Raspberry Pi Pico)   | ARM GNU Toolchain       |
| `armv7m`     | Cortex-M3                           | ARM GNU Toolchain       |
| `armv7emsp`  | Cortex-M4/M7 (single precision FPU) | ARM GNU Toolchain       |
| `armv7emdp`  | Cortex-M7 (double precision FPU)    | ARM GNU Toolchain       |
| `xtensa`     | ESP8266                             | esp-open-sdk            |
| `xtensawin`  | ESP32                               | ESP-IDF                 |
| `rv32imc`    | RISC-V (MicroPython >= 1.25)        | riscv64-unknown-elf-gcc |

## Usage

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: all # or specific: x64, armv6m, xtensawin, etc.
    micropython-version: v1.24.1 # or comma-separated: "v1.23.0, v1.24.1, v1.25.0"
    source-dir: . # Directory containing your Makefile
```

## Inputs

| Input                              | Required | Default                                      | Description                                                                                                              |
| ---------------------------------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `architecture`                     | No       | `all`                                        | Target architecture(s) to build                                                                                          |
| `micropython-version`              | **Yes**  | -                                            | MicroPython version(s) - single (`v1.24.1`) or comma-separated (`v1.23.0, v1.24.1`)                                      |
| `micropython-repo`                 | No       | `https://github.com/micropython/micropython` | MicroPython repository URL (useful for testing with forks)                                                               |
| `source-dir`                       | No       | `.`                                          | Directory containing native module source and Makefile                                                                   |
| `output-name`                      | No       | Auto-detect                                  | Base name for output `.mpy` file (detected from Makefile `MOD` variable)                                                 |
| `make-target`                      | No       | (default)                                    | Make target to build                                                                                                     |
| `make-args`                        | No       | -                                            | Additional arguments to pass to make (e.g., `DEBUG=1`)                                                                   |
| `parallel-builds`                  | No       | `0`                                          | Number of concurrent builds (0 = sequential, 1-9 = parallel)                                                             |
| `cache-toolchains`                 | No       | `true`                                       | Cache slow toolchain builds (xtensa, xtensawin)                                                                          |
| `static-const-workaround`          | No       | `false`                                      | Apply `static const` → `const` workaround ([micropython#14429](https://github.com/micropython/micropython/issues/14429)) |
| `static-const-workaround-patterns` | No       | `**/*.c,**/*.h`                              | Glob patterns for static const workaround (comma-separated)                                                              |
| `esp-idf-version`                  | No       | `v5.0.6`                                     | ESP-IDF version for xtensawin builds                                                                                     |
| `esp-open-sdk-repo`                | No       | (BrianPugh fork)                             | Repository for esp-open-sdk (xtensa builds)                                                                              |
| `esp-open-sdk-branch`              | No       | `fix-ubuntu-21.10-build`                     | Branch for esp-open-sdk                                                                                                  |

## Outputs

| Output                 | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `mpy-file`             | Path to built `.mpy` file (single arch/version) or output directory |
| `mpy-files`            | JSON array of all built `.mpy` file paths                           |
| `output-dir`           | Directory containing all built files                                |
| `mpy-dir`              | Path to the MicroPython directory (`MPY_DIR`)                       |
| `architecture`         | The architecture input that was provided                            |
| `architectures`        | JSON array of successfully built architectures                      |
| `micropython-versions` | JSON array of successfully built MicroPython versions               |
| `toolchain-cache-hit`  | Whether the toolchain cache was hit (`true`/`false`)                |

## Output File Naming

Output `.mpy` files follow this naming convention:

```
{module}-mpy{major.minor}-{architecture}.mpy
```

| Component        | Description                                                       | Example                      |
| ---------------- | ----------------------------------------------------------------- | ---------------------------- |
| `{module}`       | Module name (from Makefile `MOD` variable or `output-name` input) | `fnv1a32`                    |
| `{major.minor}`  | MicroPython major.minor version                                   | `1.24`                       |
| `{architecture}` | Target architecture                                               | `x64`, `armv6m`, `xtensawin` |

**Examples:**

- `fnv1a32-mpy1.24-x64.mpy` - fnv1a32 module for MicroPython 1.24.x on x64
- `mymodule-mpy1.25-armv6m.mpy` - mymodule for MicroPython 1.25.x on Raspberry Pi Pico
- `sensor-mpy1.24-xtensawin.mpy` - sensor module for MicroPython 1.24.x on ESP32

This naming scheme ensures unique filenames when building for multiple architectures and/or MicroPython versions, allowing all outputs to coexist in the same directory.

## Examples

### Build for All Architectures

```yaml
name: Build Native Module

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: BrianPugh/build-mpy-native-module@main
        id: build
        with:
          micropython-version: v1.24.1
          parallel-builds: 4

      - uses: actions/upload-artifact@v4
        with:
          name: native-modules
          path: ${{ steps.build.outputs.output-dir }}/*.mpy
```

### Build for Multiple MicroPython Versions

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  id: build
  with:
    architecture: x64
    micropython-version: 'v1.22.2, v1.23.0, v1.24.1, v1.25.0'
# Outputs files like:
#   mymodule-mpy1.22-x64.mpy
#   mymodule-mpy1.23-x64.mpy
#   mymodule-mpy1.24-x64.mpy
#   mymodule-mpy1.25-x64.mpy
```

### Build Matrix (All Versions × All Architectures)

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: all
    micropython-version: 'v1.24.1, v1.25.0'
    parallel-builds: 4
# Builds 18 .mpy files (9 architectures × 2 versions)
```

### Build with a MicroPython Fork

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: my-feature-branch
    micropython-repo: https://github.com/myuser/micropython
    architecture: x64
```

## Platform Support

This action runs on **ubuntu-latest** GitHub runners. Toolchains are installed to the user's home directory (`~/.mpy-toolchains/`) for cross-platform compatibility.

## License

Apache-2.0
