# Build MicroPython Native Module

A GitHub Action to cross-compile MicroPython native modules (`.mpy` files) for all supported architectures.

## MPY Subversion Mapping

This action uses the recommended (most recent) MicroPython version for each MPY subversion to ensure you get the latest bugfixes and optimizations. See the [MicroPython docs](https://docs.micropython.org/en/latest/reference/mpyfiles.html#versioning-and-compatibility-of-mpy-files) for more information.

| MPY Version | MicroPython Range | Recommended | rv32imc |
| ----------- | ----------------- | ----------- | ------- |
| 6.3         | v1.23.0+          | v1.27.0     | Yes     |
| 6.2         | v1.22.x           | v1.22.2     | No      |
| 6.1         | v1.20-v1.21.0     | v1.21.0     | No      |
| 6           | v1.19.x           | v1.19.1     | No      |
| 5           | v1.12-v1.18       | v1.18       | No      |

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
| `rv32imc`    | RISC-V (mpy 6.3+ only)              | riscv64-unknown-elf-gcc |

## Usage

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    mpy-version: 6.3  # MPY subversion (default: 6.3)
```

## Inputs

### `mpy-version`

MPY subversion(s) to build for. Can be a single version, comma-separated list, or `all`. Default: `6.3`

```yaml
# Single version (latest)
- uses: BrianPugh/build-mpy-native-module@main
  with:
    mpy-version: 6.3

# Multiple versions
- uses: BrianPugh/build-mpy-native-module@main
  with:
    mpy-version: 6.2, 6.3

# All supported versions
- uses: BrianPugh/build-mpy-native-module@main
  with:
    mpy-version: all
```

### `architecture`

Target architecture(s) to build. Default: `all`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: armv6m
```

### `micropython-version` (Advanced)

Override the MicroPython version directly instead of using the recommended version for each MPY subversion. Mutually exclusive with custom `mpy-version`.

```yaml
# Use a specific MicroPython version (e.g., for testing a fork or pre-release)
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-version: v1.26.0
```

### `micropython-repo`

MicroPython repository URL (useful for testing with forks). Default: `https://github.com/micropython/micropython`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    micropython-repo: https://github.com/myuser/micropython
    micropython-version: my-feature-branch
```

### `source-dir`

Directory containing native module source and Makefile. Default: `.`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    source-dir: src/native
```

### `output-name`

Base name for output `.mpy` file. Default: Auto-detected from Makefile `MOD` variable.

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    output-name: mymodule
```

### `make-target`

Make target to build. Default: (default target)

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    make-target: release
```

### `make-args`

Additional arguments to pass to make.

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    make-args: DEBUG=1
```

### `mpy-cross-args`

Additional arguments to pass to mpy-cross. This is useful for enabling architecture-specific extensions.

```yaml
# Enable the "zba" (bit manipulation) extension for rv32imc
- uses: BrianPugh/build-mpy-native-module@main
  with:
    mpy-version: 6.3
    architecture: rv32imc
    mpy-cross-args: -march-flags=zba
```

### `parallel-builds`

Number of concurrent builds (0 = sequential, 1-9 = parallel). Default: `4`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    parallel-builds: 0  # Sequential builds
```

### `cache-toolchains`

Cache slow toolchain builds (xtensa, xtensawin). Default: `true`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    cache-toolchains: false
```

### `static-const-workaround`

Apply `static const` -> `const` workaround ([micropython#14429](https://github.com/micropython/micropython/issues/14429)). Default: `false`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    static-const-workaround: true
```

### `static-const-workaround-patterns`

Glob patterns for static const workaround (comma-separated). Default: `**/*.c,**/*.h`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    static-const-workaround: true
    static-const-workaround-patterns: src/**/*.c,include/**/*.h
```

### `esp-idf-version`

ESP-IDF version for xtensawin builds. Default: `v5.0.6`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: xtensawin
    esp-idf-version: v5.2
```

### `esp-open-sdk-repo`

Repository for esp-open-sdk (xtensa builds). Default: BrianPugh fork with maintenance fixes.

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: xtensa
    esp-open-sdk-repo: https://github.com/pfalcon/esp-open-sdk
```

### `esp-open-sdk-branch`

Branch for esp-open-sdk. Default: `fix-ubuntu-21.10-build`

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: xtensa
    esp-open-sdk-branch: master
```

## Outputs

| Output                 | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `mpy-file`             | Path to built `.mpy` file (single arch/version) or output directory |
| `mpy-files`            | JSON array of all built `.mpy` file paths                            |
| `output-dir`           | Directory containing all built files                                 |
| `mpy-dir`              | Path to the MicroPython directory (`MPY_DIR`)                        |
| `architecture`         | The architecture input that was provided                             |
| `architectures`        | JSON array of successfully built architectures                       |
| `mpy-versions`         | JSON array of successfully built MPY subversions                     |
| `micropython-versions` | JSON array of MicroPython versions used for building                 |
| `toolchain-cache-hit`  | Whether the toolchain cache was hit (`true`/`false`)                 |

## Output File Naming

Output `.mpy` files follow this naming convention:

```
{module}-mpy{version}-{architecture}.mpy
```

| Component        | Description                                                       | Example                      |
| ---------------- | ----------------------------------------------------------------- | ---------------------------- |
| `{module}`       | Module name (from Makefile `MOD` variable or `output-name` input) | `fnv1a32`                    |
| `{version}`      | MPY subversion                                                    | `6.3`, `6.2`, `6`            |
| `{architecture}` | Target architecture                                               | `x64`, `armv6m`, `xtensawin` |

**Examples:**

- `fnv1a32-mpy6.3-x64.mpy` - fnv1a32 module for mpy 6.3 on x64
- `mymodule-mpy6.3-armv6m.mpy` - mymodule for mpy 6.3 on Raspberry Pi Pico
- `sensor-mpy6.2-xtensawin.mpy` - sensor module for mpy 6.2 on ESP32

This naming scheme ensures unique filenames when building for multiple architectures and/or MPY versions, allowing all outputs to coexist in the same directory.

## Examples

### Build for All Architectures (Default)

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
        # Uses defaults: mpy-version: 6.3, architecture: all

      - uses: actions/upload-artifact@v4
        with:
          name: native-modules
          path: ${{ steps.build.outputs.output-dir }}/*.mpy
```

### Build for Multiple MPY Versions

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  id: build
  with:
    architecture: x64
    mpy-version: 6, 6.1, 6.2, 6.3
# Outputs files like:
#   mymodule-mpy6-x64.mpy
#   mymodule-mpy6.1-x64.mpy
#   mymodule-mpy6.2-x64.mpy
#   mymodule-mpy6.3-x64.mpy
```

### Build Matrix (All Versions x All Architectures)

```yaml
- uses: BrianPugh/build-mpy-native-module@main
  with:
    architecture: all
    mpy-version: 6.2, 6.3
# Builds 17 .mpy files:
#   mpy 6.2: 8 architectures (rv32imc not supported)
#   mpy 6.3: 9 architectures (all)
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
