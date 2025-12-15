import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyStaticConstWorkaround } from '../build/workarounds';

describe('applyStaticConstWorkaround', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workaround-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('replaces "static const" with "const" in C files', async () => {
    const testFile = path.join(tempDir, 'test.c');
    const originalContent = `
static const int MY_VALUE = 42;
static const char* MY_STRING = "hello";
int other_var = 10;
`;
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(1);
    const newContent = fs.readFileSync(testFile, 'utf-8');
    expect(newContent).toContain('const int MY_VALUE = 42');
    expect(newContent).toContain('const char* MY_STRING = "hello"');
    expect(newContent).not.toContain('static const');
    expect(newContent).toContain('int other_var = 10'); // Unchanged
  });

  it('replaces "static const" with "const" in header files', async () => {
    const testFile = path.join(tempDir, 'test.h');
    const originalContent = `
#ifndef TEST_H
#define TEST_H

static const int HEADER_VALUE = 100;

#endif
`;
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.h']);

    expect(modified).toBe(1);
    const newContent = fs.readFileSync(testFile, 'utf-8');
    expect(newContent).toContain('const int HEADER_VALUE = 100');
    expect(newContent).not.toContain('static const');
  });

  it('handles multiple patterns', async () => {
    const cFile = path.join(tempDir, 'code.c');
    const hFile = path.join(tempDir, 'header.h');

    fs.writeFileSync(cFile, 'static const int A = 1;');
    fs.writeFileSync(hFile, 'static const int B = 2;');

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c', '**/*.h']);

    expect(modified).toBe(2);
    expect(fs.readFileSync(cFile, 'utf-8')).toBe('const int A = 1;');
    expect(fs.readFileSync(hFile, 'utf-8')).toBe('const int B = 2;');
  });

  it('returns 0 when no files match the pattern', async () => {
    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);
    expect(modified).toBe(0);
  });

  it('returns 0 when files have no static const', async () => {
    const testFile = path.join(tempDir, 'test.c');
    fs.writeFileSync(testFile, 'int my_var = 42;');

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(0);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('int my_var = 42;');
  });

  it('handles static followed by newline and const', async () => {
    const testFile = path.join(tempDir, 'test.c');
    // The regex \bstatic\s+(const\b) should match static followed by whitespace including newlines
    const originalContent = 'static\nconst int VALUE = 1;';
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(1);
    const newContent = fs.readFileSync(testFile, 'utf-8');
    // "static\nconst" is replaced with just "const" (the captured group)
    expect(newContent).toBe('const int VALUE = 1;');
  });

  it('does not modify "static" alone or "const" alone', async () => {
    const testFile = path.join(tempDir, 'test.c');
    const originalContent = `
static int static_var = 1;
const int const_var = 2;
static void my_function(void) {}
`;
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(0);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe(originalContent);
  });

  it('does not modify static const in single-line comments', async () => {
    const testFile = path.join(tempDir, 'test.c');
    const originalContent = `
// static const int COMMENTED_VALUE = 1;
static const int REAL_VALUE = 2;
`;
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(1);
    const newContent = fs.readFileSync(testFile, 'utf-8');
    // Comment should be preserved
    expect(newContent).toContain('// static const int COMMENTED_VALUE = 1;');
    // Real code should have "static const" changed to "const"
    expect(newContent).toContain('const int REAL_VALUE = 2;');
    expect(newContent).not.toContain('static const int REAL_VALUE');
  });

  it('does not modify static const in multi-line comments', async () => {
    const testFile = path.join(tempDir, 'test.c');
    const originalContent = `
/* static const int COMMENTED = 1; */
static const int REAL = 2;
/*
 * static const int ALSO_COMMENTED = 3;
 */
`;
    fs.writeFileSync(testFile, originalContent);

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(1);
    const newContent = fs.readFileSync(testFile, 'utf-8');
    // Comments should be preserved
    expect(newContent).toContain('/* static const int COMMENTED = 1; */');
    expect(newContent).toContain('static const int ALSO_COMMENTED = 3;');
    // Real code should be modified
    expect(newContent).toContain('const int REAL = 2;');
  });

  it('handles files in subdirectories', async () => {
    const subDir = path.join(tempDir, 'src', 'lib');
    fs.mkdirSync(subDir, { recursive: true });
    const testFile = path.join(subDir, 'deep.c');
    fs.writeFileSync(testFile, 'static const int DEEP = 999;');

    const modified = await applyStaticConstWorkaround(tempDir, ['**/*.c']);

    expect(modified).toBe(1);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('const int DEEP = 999;');
  });
});
