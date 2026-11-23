import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../support/fs-walk';
import { findDistLeaks, keyNeedlesFromJwk, KEY_FILE_NAME } from '../support/dist-scan';

// Test dist_clean (terminal-ui Requirement 10.8, example, one run).
//
// The scanner runs on fixture folders in the system temp directory, always. The real `dist` folder
// is scanned only when CHECK_DIST=1, so `npm test` needs no build. The key is read in a TEST
// (public by design). Failure messages hold relative paths and rule names only.

const KEY = keyNeedlesFromJwk(readFileSync(join(REPO_ROOT, 'scripts', 'demo-key', `${KEY_FILE_NAME}.json`), 'utf8'));
const roots: string[] = [];

function fixture(files: Readonly<Record<string, string | Buffer>>): string {
  const root = mkdtempSync(join(tmpdir(), 'cryptterm-dist-'));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const CLEAN_FILES: Readonly<Record<string, string>> = {
  'index.html': '<!doctype html><title>CRYPTTERM</title>',
  'assets/index-abc123.js': 'console.log("x")',
  'samples/clean.dat': 'HDR',
  '_redirects': '/*  /index.html  200',
};

describe('dist_clean', () => {
  it('dist_clean: a clean fixture folder has no finding', () => {
    expect(findDistLeaks(fixture(CLEAN_FILES), KEY)).toEqual([]);
  });

  it('dist_clean: files from e2e, tests or scripts are found by path', () => {
    const dist = fixture({
      ...CLEAN_FILES,
      'e2e/prover.spec.js': '',
      'tests/ui/a.js': '',
      'scripts/gen-samples.js': '',
    });
    expect(findDistLeaks(dist, KEY).sort()).toEqual(
      ['e2e/prover.spec.js e2e', 'scripts/gen-samples.js source folder', 'tests/ui/a.js source folder'].sort(),
    );
  });

  it('dist_clean: the key file name and the key bytes are found, in text and in binary files', () => {
    const dist = fixture({
      ...CLEAN_FILES,
      [`${KEY_FILE_NAME}.json`]: '{}',
      'assets/a.js': `x = "${KEY.dBase64Url}"`,
      'assets/b.js': `x = "${KEY.dHex.toUpperCase()}"`,
      'assets/c.bin': Buffer.concat([Buffer.from([0, 1, 2]), KEY.dBytes, Buffer.from([3])]),
      'assets/d.js': `import("../${KEY_FILE_NAME}")`,
    });
    expect(findDistLeaks(dist, KEY).sort()).toEqual(
      [
        `${KEY_FILE_NAME}.json key file name`,
        'assets/a.js key bytes',
        'assets/b.js key bytes',
        'assets/c.bin key bytes',
        'assets/d.js key file name in content',
      ].sort(),
    );
  });

  it('dist_clean: a folder that does not exist has no finding and the key reader shows no value on a bad file', () => {
    expect(findDistLeaks(join(tmpdir(), 'cryptterm-no-such-dist'), KEY)).toEqual([]);
    expect(() => keyNeedlesFromJwk('{"d":"AAAA"}')).toThrow('TEST KEY FILE WRONG LENGTH');
    expect(() => keyNeedlesFromJwk('[]')).toThrow('TEST KEY FILE LACKS d');
  });

  it.runIf(process.env['CHECK_DIST'] === '1')('dist_clean: the built dist folder holds none of them', () => {
    const dist = join(REPO_ROOT, 'dist');
    expect(findDistLeaks(dist, KEY)).toEqual([]);
    expect(readFileSync(join(dist, 'index.html'), 'utf8').length).toBeGreaterThan(0);
  });
});
