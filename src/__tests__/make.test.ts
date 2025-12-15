import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findMpyFile } from '../build/make';

describe('findMpyFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'findMpyFile-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no .mpy files exist', async () => {
    const result = await findMpyFile(tempDir);
    expect(result).toBeNull();
  });

  it('returns single .mpy file when only one exists', async () => {
    const mpyFile = path.join(tempDir, 'mymodule.mpy');
    fs.writeFileSync(mpyFile, 'fake mpy content');

    const result = await findMpyFile(tempDir);
    expect(result).toBe(mpyFile);
  });

  it('prefers file matching expectedName', async () => {
    const file1 = path.join(tempDir, 'wrong.mpy');
    const file2 = path.join(tempDir, 'expected.mpy');

    fs.writeFileSync(file1, 'fake content 1');
    // Small delay to ensure different mtimes
    await new Promise((resolve) => setTimeout(resolve, 10));
    fs.writeFileSync(file2, 'fake content 2');

    const result = await findMpyFile(tempDir, 'expected');
    expect(result).toBe(file2);
  });

  it('matches expectedName with .mpy extension', async () => {
    const file1 = path.join(tempDir, 'other.mpy');
    const file2 = path.join(tempDir, 'target.mpy');

    fs.writeFileSync(file1, 'fake content 1');
    fs.writeFileSync(file2, 'fake content 2');

    const result = await findMpyFile(tempDir, 'target.mpy');
    expect(result).toBe(file2);
  });

  it('returns most recent file when multiple exist and no expectedName matches', async () => {
    const file1 = path.join(tempDir, 'old.mpy');
    const file2 = path.join(tempDir, 'new.mpy');

    fs.writeFileSync(file1, 'old content');
    // Wait to ensure different mtime
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(file2, 'new content');

    const result = await findMpyFile(tempDir);
    expect(result).toBe(file2);
  });

  it('returns most recent file when expectedName not found', async () => {
    const file1 = path.join(tempDir, 'old.mpy');
    const file2 = path.join(tempDir, 'new.mpy');

    fs.writeFileSync(file1, 'old content');
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(file2, 'new content');

    // Expected name doesn't match either file
    const result = await findMpyFile(tempDir, 'nonexistent');
    expect(result).toBe(file2);
  });

  it('ignores non-.mpy files', async () => {
    const txtFile = path.join(tempDir, 'readme.txt');
    const mpyFile = path.join(tempDir, 'module.mpy');

    fs.writeFileSync(txtFile, 'text content');
    fs.writeFileSync(mpyFile, 'mpy content');

    const result = await findMpyFile(tempDir);
    expect(result).toBe(mpyFile);
  });
});
