import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirements 7.2 (no absolute paths in the committed Artifact), 7.8 (Artifact sha256)
// and 7.9 (exact nargo version).
//
// The test reads the committed files only. It never runs nargo and never touches the
// network or bb.js. In particular, NO comparison of `bytecode` and `abi` with a fresh
// `nargo compile` is part of this test (there is no nargo in CI).

const ARTIFACT_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.json', import.meta.url),
);
const META_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.meta.json', import.meta.url),
);

const EXPECTED_NARGO_VERSION = '1.0.0';
const META_KEYS: readonly string[] = ['nargoVersion', 'artifactSha256'];
const SHA256_HEX = /^[0-9a-f]{64}$/;
const NARGO_VERSION_LINE = /^nargo version = (\S+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readMetaText(): string | undefined {
  return existsSync(META_PATH) ? readFileSync(META_PATH, 'utf8') : undefined;
}

// ---------------------------------------------------------------------------
// Requirement 7.8: checksum
// ---------------------------------------------------------------------------

/**
 * Returns one message per violated rule; an empty list means the Meta is valid and its
 * `artifactSha256` equals the sha256 of the exact Artifact bytes.
 * `metaText` is `undefined` when the Meta file is missing.
 */
function validateChecksum(artifactBytes: Uint8Array, metaText: string | undefined): string[] {
  if (metaText === undefined) {
    return ['Meta file is missing'];
  }
  let meta: unknown;
  try {
    meta = JSON.parse(metaText);
  } catch {
    return ['Meta file is not valid JSON'];
  }
  if (!isRecord(meta)) {
    return ['Meta is not a JSON object'];
  }
  const problems: string[] = [];
  const keys = Object.keys(meta);
  if (keys.length !== META_KEYS.length || keys.some((key, index) => key !== META_KEYS[index])) {
    problems.push('Meta keys are not exactly nargoVersion, artifactSha256 in that order');
  }
  const recorded = meta['artifactSha256'];
  if (typeof recorded !== 'string' || !SHA256_HEX.test(recorded)) {
    problems.push('artifactSha256 is not 64 lowercase hex characters');
  } else if (recorded !== sha256Hex(artifactBytes)) {
    problems.push('artifactSha256 differs from the sha256 of the Artifact bytes');
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Requirement 7.9: nargo version
// ---------------------------------------------------------------------------

/**
 * The value must be `nargo version = <token>` with the token equal to `1.0.0`. The token
 * is compared whole by string equality; it is never cut to a numeric prefix, so
 * `1.0.0-beta.1` and `1.0.0+build5` fail.
 */
function validateNargoVersion(value: unknown): string[] {
  if (typeof value !== 'string') {
    return ['nargoVersion is missing or not a string'];
  }
  const match = NARGO_VERSION_LINE.exec(value);
  if (match === null) {
    return ['nargoVersion does not match "nargo version = <token>"'];
  }
  if (match[1] !== EXPECTED_NARGO_VERSION) {
    return [`nargoVersion token is not exactly ${EXPECTED_NARGO_VERSION}`];
  }
  return [];
}

function nargoVersionOf(metaText: string | undefined): unknown {
  if (metaText === undefined) {
    return undefined;
  }
  try {
    const meta: unknown = JSON.parse(metaText);
    return isRecord(meta) ? meta['nargoVersion'] : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Requirement 7.2: no absolute paths in the committed Artifact
// ---------------------------------------------------------------------------

// A Windows drive path is a single letter, `:`, then a path separator. The separator is
// one `\` (raw text), two `\\` (JSON-escaped text) or `/`. A bare `[A-Za-z]:(\\|/)` also
// matches the tail of every URL scheme (`https://` ends in `s://`), and the Artifact holds
// such URLs in the doc comments of the Noir standard library sources in `file_map`
// (22 false positives were seen in the committed file). So the letter must stand alone:
// it is not preceded by a letter or digit (a URL scheme always is), or it directly follows
// a JSON newline/tab escape (`\n`, `\r`, `\t`), which is how a path at the start of a
// source line looks inside the escaped text.
const DRIVE_PATH = /(?:(?<![A-Za-z0-9])|(?<=\\[nrt]))[A-Za-z]:(?:\\\\|\\|\/)/;
const FORBIDDEN_SUBSTRINGS: readonly string[] = ['/Users/', '/home/'];
// Shorter home directories (`/`, `/a`) would match unrelated text.
const MIN_HOME_LENGTH = 4;

/**
 * Returns one message per violated rule. `homeDirectory` is the home directory of the
 * machine that runs the test; it is skipped when 3 characters or shorter.
 */
function validateNoAbsolutePaths(text: string, homeDirectory: string): string[] {
  const problems: string[] = [];
  for (const substring of FORBIDDEN_SUBSTRINGS) {
    if (text.includes(substring)) {
      problems.push(`text contains ${substring}`);
    }
  }
  if (DRIVE_PATH.test(text)) {
    problems.push('text contains a Windows drive path');
  }
  if (homeDirectory.length >= MIN_HOME_LENGTH) {
    // The JSON-escaped form covers a Windows home directory such as `C:\Users\x`.
    const escapedHome = JSON.stringify(homeDirectory).slice(1, -1);
    if (text.includes(homeDirectory) || text.includes(escapedHome)) {
      problems.push('text contains the home directory of this machine');
    }
  }
  return problems;
}

type PathForm = 'absolute' | 'tilde' | 'drive';

/**
 * The same rule as the generic check in `scripts/build-circuit` (task 6.0): a path is not
 * relative when it starts with `/` or `\` (POSIX root, Windows root, UNC), with `~`, or
 * with a drive letter followed by `:` and a separator. Applies to the parsed string, so the
 * JSON-escaped text form `C:\\x` has already become `C:\x` here.
 */
function absolutePathForm(path: string): PathForm | null {
  if (path.startsWith('~')) {
    return 'tilde';
  }
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return 'drive';
  }
  if (path.startsWith('/') || path.startsWith('\\')) {
    return 'absolute';
  }
  return null;
}

/** Every value stored under a key named `path`, at any depth, with its location. */
function collectPathValues(value: unknown, location: string, found: Array<[string, string]>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPathValues(item, `${location}[${index}]`, found));
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const here = `${location}.${key}`;
      if (key === 'path' && typeof item === 'string') {
        found.push([here, item]);
      }
      collectPathValues(item, here, found);
    }
  }
}

/**
 * Every `file_map` path of the parsed Artifact must be relative: no leading `/`, `\` or `~`
 * and no drive letter. The `path` of each entry must be a string, and any nested `path`
 * key inside an entry is checked the same way.
 */
function validateFileMapPaths(artifact: unknown): string[] {
  if (!isRecord(artifact) || !isRecord(artifact['file_map'])) {
    return ['Artifact has no file_map object'];
  }
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(artifact['file_map'])) {
    if (!isRecord(entry) || typeof entry['path'] !== 'string') {
      problems.push(`file_map entry ${key} has no string path`);
      continue;
    }
    const found: Array<[string, string]> = [];
    collectPathValues(entry, `file_map[${key}]`, found);
    for (const [location, path] of found) {
      const form = absolutePathForm(path);
      if (form !== null) {
        problems.push(`${location} has a non-relative path (${form})`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Committed files and derived mutations
// ---------------------------------------------------------------------------

const artifactBytes = readFileSync(ARTIFACT_PATH);
const artifactText = artifactBytes.toString('utf8');
const metaText = readMetaText();
const home = homedir();

/** The committed Meta with one field replaced, serialised like the Build_Script does. */
function metaWith(overrides: Record<string, unknown>): string {
  const base: Record<string, unknown> = { nargoVersion: 'nargo version = 1.0.0' };
  const sha = metaText === undefined ? '' : String(JSON.parse(metaText)['artifactSha256']);
  base['artifactSha256'] = sha;
  return `${JSON.stringify({ ...base, ...overrides }, null, 2)}\n`;
}

describe('Artifact_Meta checksum (Requirement 7.8)', () => {
  it('accepts the committed Artifact and Meta', () => {
    expect(validateChecksum(artifactBytes, metaText)).toEqual([]);
  });

  it('recomputes the digest as lowercase hex over the exact bytes', () => {
    const recorded: unknown = metaText === undefined ? undefined : JSON.parse(metaText).artifactSha256;
    expect(recorded).toBe(sha256Hex(artifactBytes));
  });

  const sha = (): string => sha256Hex(artifactBytes);
  const mutatedMetas: ReadonlyArray<readonly [string, string | undefined]> = [
    ['wrong hash value', metaWith({ artifactSha256: '0'.repeat(64) })],
    ['uppercase hex', metaWith({ artifactSha256: sha().toUpperCase() })],
    ['63 characters', metaWith({ artifactSha256: sha().slice(0, 63) })],
    ['65 characters', metaWith({ artifactSha256: `${sha()}0` })],
    ['non-hex characters', metaWith({ artifactSha256: `${sha().slice(0, 63)}g` })],
    ['not a string', metaWith({ artifactSha256: 12345 })],
    ['missing artifactSha256 key', JSON.stringify({ nargoVersion: 'nargo version = 1.0.0' })],
    ['missing nargoVersion key', JSON.stringify({ artifactSha256: sha() })],
    ['extra key', metaWith({ builtAt: '2026-11-20' })],
    [
      'keys in the wrong order',
      JSON.stringify({ artifactSha256: sha(), nargoVersion: 'nargo version = 1.0.0' }),
    ],
    ['missing Meta file', undefined],
    ['invalid JSON text', '{ "nargoVersion": "nargo version = 1.0.0", '],
    ['JSON that is not an object', '[]'],
  ];

  it.each(mutatedMetas)('rejects a Meta with %s', (_name, mutated) => {
    expect(validateChecksum(artifactBytes, mutated)).not.toEqual([]);
  });

  it('rejects the committed Meta when one Artifact byte is flipped', () => {
    const flipped = Buffer.from(artifactBytes);
    const index = Math.floor(flipped.length / 2);
    flipped[index] = (flipped[index] ?? 0) ^ 0x01;
    expect(validateChecksum(flipped, metaText)).toEqual([
      'artifactSha256 differs from the sha256 of the Artifact bytes',
    ]);
  });
});

describe('nargo version (Requirement 7.9)', () => {
  it('accepts the committed Meta', () => {
    expect(validateNargoVersion(nargoVersionOf(metaText))).toEqual([]);
  });

  const mutatedVersions: ReadonlyArray<readonly [string, unknown]> = [
    ['pre-release suffix', 'nargo version = 1.0.0-beta.1'],
    ['build suffix', 'nargo version = 1.0.0+build5'],
    ['patch bump', 'nargo version = 1.0.1'],
    ['empty string', ''],
    ['missing value', undefined],
    ['not a string', 100],
    ['another first-line shape', 'nargo 1.0.0'],
    ['trailing words', 'nargo version = 1.0.0 extra'],
    ['leading space', ' nargo version = 1.0.0'],
    ['trailing newline', 'nargo version = 1.0.0\n'],
    ['trailing space', 'nargo version = 1.0.0 '],
    ['no token', 'nargo version = '],
  ];

  it.each(mutatedVersions)('rejects %s', (_name, mutated) => {
    expect(validateNargoVersion(mutated)).not.toEqual([]);
  });
});

describe('no absolute paths in the committed Artifact (Requirement 7.2)', () => {
  it('accepts the committed Artifact text', () => {
    expect(validateNoAbsolutePaths(artifactText, home)).toEqual([]);
  });

  it('does not contain the home directory of this machine', () => {
    if (home.length >= MIN_HOME_LENGTH) {
      expect(artifactText.includes(home)).toBe(false);
    }
  });

  const mutatedTexts: ReadonlyArray<readonly [string, string]> = [
    ['/Users/', 'prefix /Users/x/proj/src/main.nr end'],
    ['/home/', '{"path":"/home/ci/work/src/main.nr"}'],
    ['JSON-escaped drive path', '{"path":"C:\\\\Users\\\\x"}'],
    ['plain backslash drive path', 'C:\\Users\\x'],
    ['forward-slash drive path', 'D:/a/b'],
    ['drive path after a JSON newline escape', 'line one\\nE:\\\\work\\\\main.nr'],
    ['lowercase drive letter', 'path c:\\\\temp'],
  ];

  it.each(mutatedTexts)('rejects text with %s', (_name, mutated) => {
    expect(validateNoAbsolutePaths(mutated, home)).not.toEqual([]);
  });

  it('rejects text with the home directory of the running machine', () => {
    expect(validateNoAbsolutePaths('x /opt/build/me/proj y', '/opt/build/me')).not.toEqual([]);
    expect(validateNoAbsolutePaths('x C:\\\\Users\\\\me\\\\p y', 'C:\\Users\\me')).not.toEqual([]);
  });

  it('ignores a home directory of 3 characters or fewer', () => {
    expect(validateNoAbsolutePaths('some/text', '/a')).toEqual([]);
    expect(validateNoAbsolutePaths('some/text', '')).toEqual([]);
  });

  const cleanTexts: ReadonlyArray<readonly [string, string]> = [
    ['relative paths', '{"path":"src/main.nr","source":"fn main() {}"}'],
    ['URLs and base64', 'see https://github.com/x and http://a.b/c, ZGF0YQ==, ab12:cd34'],
    ['a URL at the start of a line', 'doc\\nhttps://example.org/page'],
  ];

  it.each(cleanTexts)('accepts %s', (_name, clean) => {
    expect(validateNoAbsolutePaths(clean, home)).toEqual([]);
  });

  it('rejects the committed text when one file_map path becomes /Users/x/y/main.nr', () => {
    const needle = '"path":"src/main.nr"';
    expect(artifactText.split(needle).length - 1).toBe(1);
    const mutated = artifactText.replace(needle, '"path":"/Users/x/y/main.nr"');
    expect(mutated).not.toBe(artifactText);
    expect(validateNoAbsolutePaths(mutated, home)).not.toEqual([]);
  });
});

describe('committed Artifact shape', () => {
  const artifact: unknown = JSON.parse(artifactText);

  it('parses as JSON with a bytecode string and an abi object', () => {
    expect(isRecord(artifact)).toBe(true);
    if (!isRecord(artifact)) {
      return;
    }
    expect(typeof artifact['bytecode']).toBe('string');
    expect(isRecord(artifact['abi'])).toBe(true);
  });

  it('has only relative file_map paths', () => {
    expect(validateFileMapPaths(artifact)).toEqual([]);
  });

  it.each([
    ['an absolute path', '/Users/x/y/main.nr', 'absolute'],
    ['an absolute path outside any home', '/opt/ci/work/src/main.nr', 'absolute'],
    ['a root-only path', '/', 'absolute'],
    ['a backslash root', '\\work\\main.nr', 'absolute'],
    ['a UNC path', '\\\\server\\share\\a.nr', 'absolute'],
    ['a tilde path', '~/x.nr', 'tilde'],
    ['a bare tilde', '~', 'tilde'],
    ['a drive path', 'C:\\work\\main.nr', 'drive'],
    ['a lowercase drive path', 'c:\\work\\main.nr', 'drive'],
    ['a drive path with a slash', 'D:/a/b.nr', 'drive'],
  ])('rejects a file_map with %s', (_name, path, form) => {
    const problems = validateFileMapPaths({ file_map: { '1': { path, source: '' } } });
    expect(problems).toEqual([`file_map[1].path has a non-relative path (${form})`]);
  });

  it.each([
    ['a plain relative path', 'src/main.nr'],
    ['a standard library path', 'std/hash/mod.nr'],
    ['a dot-relative path', './src/main.nr'],
    ['a tilde inside the path', 'src/~tmp/a.nr'],
    ['a colon inside the path', 'src/a:b.nr'],
  ])('accepts a file_map with %s', (_name, path) => {
    expect(validateFileMapPaths({ file_map: { '1': { path, source: '' } } })).toEqual([]);
  });

  it('rejects an entry without a string path, and a nested absolute path key', () => {
    expect(validateFileMapPaths({ file_map: { '1': { source: '' } } })).not.toEqual([]);
    expect(validateFileMapPaths({ file_map: { '1': { path: 5 } } })).not.toEqual([]);
    expect(validateFileMapPaths({ file_map: { '1': 'src/main.nr' } })).not.toEqual([]);
    expect(
      validateFileMapPaths({ file_map: { '1': { path: 'src/a.nr', inner: { path: '/etc/p.nr' } } } }),
    ).not.toEqual([]);
  });

  describe('mutated Artifact text, one file_map path replaced (task 6.0)', () => {
    const needle = '"path":"src/main.nr"';

    // `escapedPathText` is the text between the quotes in the JSON file, so a Windows path
    // appears with doubled backslashes, as nargo writes it.
    const mutate = (escapedPathText: string): unknown => {
      expect(artifactText.split(needle).length - 1).toBe(1);
      return JSON.parse(artifactText.replace(needle, `"path":"${escapedPathText}"`));
    };

    it('accepts the committed text with the same path unchanged', () => {
      expect(validateFileMapPaths(mutate('src/main.nr'))).toEqual([]);
    });

    it.each([
      ['a tilde path', '~/x.nr', 'tilde'],
      ['an absolute path under /Users', '/Users/someone/else/file.nr', 'absolute'],
      ['an absolute path under /opt', '/opt/ci/work/src/main.nr', 'absolute'],
      ['an absolute path under /var/folders', '/var/folders/x/src/main.nr', 'absolute'],
      ['a JSON-escaped backslash drive path', 'C:\\\\x\\\\y.nr', 'drive'],
      ['a forward-slash drive path', 'D:/a/b.nr', 'drive'],
    ])('rejects %s', (_name, escapedPathText, form) => {
      expect(validateFileMapPaths(mutate(escapedPathText))).toEqual([
        `file_map[54].path has a non-relative path (${form})`,
      ]);
    });

    // The substring checks of requirement 7.2 know `/Users/`, `/home/`, a drive path and
    // this machine's home directory. These two paths hold none of them, so only the
    // file_map check rejects them. The file_map check is what closes the gap.
    it.each([
      ['/opt/ci/work/src/main.nr'],
      ['/var/folders/x/src/main.nr'],
    ])('rejects %s although the substring checks accept it', (escapedPathText) => {
      const mutatedText = artifactText.replace(needle, `"path":"${escapedPathText}"`);
      expect(validateNoAbsolutePaths(mutatedText, home)).toEqual([]);
      expect(validateFileMapPaths(JSON.parse(mutatedText))).not.toEqual([]);
    });
  });
});
