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
    micropython-version: v1.24.1 # single version or YAML list
```

## Inputs

### Required

#### `micropython-version`

MicroPython version(s) to build for. Can be a single version or a YAML list.

```yaml
# Single version
micropython-version: v1.24.1

# Multiple versions
micropython-version:
  - v1.22.2
  - v1.24.1
  - v1.25.0
```

### Optional

#### `architecture`

Target architecture(s) to build. Default: `all`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    architecture: armv6m
```

#### `micropython-repo`

MicroPython repository URL (useful for testing with forks). Default: `https://github.com/micropython/micropython`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    micropython-repo: https://github.com/myuser/micropython
```

#### `source-dir`

Directory containing native module source and Makefile. Default: `.`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    source-dir: src/native
```

#### `output-name`

Base name for output `.mpy` file. Default: Auto-detected from Makefile `MOD` variable.

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    output-name: mymodule
```

#### `make-target`

Make target to build. Default: (default target)

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    make-target: release
```

#### `make-args`

Additional arguments to pass to make.

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    make-args: DEBUG=1
```

#### `parallel-builds`

Number of concurrent builds (0 = sequential, 1-9 = parallel). Default: `0`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    parallel-builds: 4
```

#### `cache-toolchains`

Cache slow toolchain builds (xtensa, xtensawin). Default: `true`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    cache-toolchains: false
```

#### `static-const-workaround`

Apply `static const` → `const` workaround ([micropython#14429](https://github.com/micropython/micropython/issues/14429)). Default: `false`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    static-const-workaround: true
```

#### `static-const-workaround-patterns`

Glob patterns for static const workaround (comma-separated). Default: `**/*.c,**/*.h`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    static-const-workaround: true
    static-const-workaround-patterns: src/**/*.c,include/**/*.h
```

#### `esp-idf-version`

ESP-IDF version for xtensawin builds. Default: `v5.0.6`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    architecture: xtensawin
    esp-idf-version: v5.2
```

#### `esp-open-sdk-repo`

Repository for esp-open-sdk (xtensa builds). Default: BrianPugh fork

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    architecture: xtensa
    esp-open-sdk-repo: https://github.com/pfalcon/esp-open-sdk
```

#### `esp-open-sdk-branch`

Branch for esp-open-sdk. Default: `fix-ubuntu-21.10-build`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.24.1
    architecture: xtensa
    esp-open-sdk-branch: master
```

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
    micropython-version:
      - v1.22.2
      - v1.23.0
      - v1.24.1
      - v1.25.0
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
    micropython-version:
      - v1.24.1
      - v1.25.0
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
