import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Workaround: Replace "static const" with "const"
 *
 * On ESP32 (and potentially other platforms), static const variables in native
 * modules return garbage values instead of their intended constants. Removing
 * the "static" keyword resolves the issue.
 *
 * See: https://github.com/micropython/micropython/issues/14429
 * Related: https://github.com/micropython/micropython/issues/6592
 */

/**
 * Remove C-style comments from source code.
 * Handles both single-line (//) and multi-line comments.
 */
function removeComments(content: string): string {
  // Remove multi-line comments /* ... */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve newlines to maintain line structure
    return match.replace(/[^\n]/g, ' ');
  });
  // Remove single-line comments // ...
  result = result.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
  return result;
}

/**
 * Apply the static const workaround only to non-comment code.
 * Returns the modified content or null if no changes were made.
 */
function applyWorkaroundSafely(content: string): string | null {
  const strippedContent = removeComments(content);

  // Quick check: if no static const in non-comment code, skip processing
  if (!/\bstatic\s+const\b/.test(strippedContent)) {
    return null;
  }

  // Find all static const occurrences and verify they're not in comments
  const pattern = /\bstatic\s+const\b/g;
  const replacements: Array<{ start: number; end: number }> = [];
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const position = match.index;

    // Check if this position is inside a comment by comparing with stripped content
    const staticStart = strippedContent.indexOf('static', position);
    if (staticStart === position) {
      // Verify the full pattern exists at this position in stripped content
      const strippedMatch = strippedContent.slice(position, position + match[0].length);
      if (/\bstatic\s+const\b/.test(strippedMatch)) {
        replacements.push({ start: position, end: position + match[0].length });
      }
    }
  }

  if (replacements.length === 0) {
    return null;
  }

  // Apply replacements from end to start to preserve positions
  let modified = content;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end } = replacements[i];
    modified = modified.slice(0, start) + 'const' + modified.slice(end);
  }

  return modified;
}

export async function applyStaticConstWorkaround(
  sourceDir: string,
  patterns: string[]
): Promise<number> {
  core.info('Applying static const workaround...');

  let filesModified = 0;

  for (const pattern of patterns) {
    const fullPattern = path.join(sourceDir, pattern);
    core.debug(`Searching for files matching: ${fullPattern}`);

    const globber = await glob.create(fullPattern);
    const files = await globber.glob();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const modified = applyWorkaroundSafely(content);

        if (modified !== null) {
          fs.writeFileSync(file, modified);
          filesModified++;
          core.info(`Applied workaround to: ${path.relative(sourceDir, file)}`);
        }
      } catch (error) {
        core.warning(
          `Failed to process ${file}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  core.info(`Static const workaround applied to ${filesModified} file(s)`);
  return filesModified;
}
