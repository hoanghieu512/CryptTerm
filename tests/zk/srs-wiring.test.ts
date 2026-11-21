import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirement 14.7 (the SRS is loaded only from the page origin; a Cold_Run makes no request
// to the ceremony hosts), with 10.1 and 10.2 (vendored SRS). bb.js downloads the SRS from the
// ceremony hosts and caches it in IndexedDB unless `Barretenberg.new` gets `skipSrsInit: true`.
// Two rules guard this over every code file under `src/zk/`:
//   R1. Every `Barretenberg.new(` / `BarretenbergSync.new(` call passes `skipSrsInit: true`.
//   R2. No file mentions a ceremony host (raw text, comments included).
// The rules are pure functions over file text, so the negative controls below run on mutated
// in-memory text. Limits of the text scan: it does not follow import aliases
// (`import { Barretenberg as B }`) and does not model regular expression literals.

const SRC_ZK_DIR = fileURLToPath(new URL('../../src/zk/', import.meta.url));
const SKIPPED_DIRECTORY = 'artifacts';
const CEREMONY_HOSTS: readonly string[] = ['crs.aztec-cdn.foundation', 'crs.aztec-labs.com'];

/** `Barretenberg.new(` or `BarretenbergSync.new(`, with optional whitespace before `(`. */
const NEW_CALL = /\bBarretenberg(?:Sync)?\.new\s*\(/g;
/** `skipSrsInit: true` as a whole property value: only `,` or `}` may follow `true`. */
const SKIP_TRUE = /^skipSrsInit\s*:\s*true\s*(?=[,}]|$)/;

interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** Index just past the string literal that opens at `start` (quote character at `start`). */
function endOfString(text: string, start: number): number {
  const quote = text.charAt(start);
  let i = start + 1;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === '\\') {
      i += 2;
    } else if (ch === quote) {
      return i + 1;
    } else if (ch === '\n' && quote !== '`') {
      return i; // unterminated single-line string: stop at the line end
    } else {
      i += 1;
    }
  }
  return text.length;
}

/**
 * Replaces `//` and block comments with spaces (newlines kept, so offsets stay stable).
 * String literals are copied as they are, so `"https://host"` is not mistaken for a comment.
 */
export function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    const next = text.charAt(i + 1);
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = endOfString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text.charAt(i) !== '\n') {
        out += ' ';
        i += 1;
      }
    } else if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/**
 * Argument text of the call whose `(` is at `open`, without the outer parentheses, or
 * `undefined` when the parentheses never balance. Parentheses inside strings are ignored.
 */
function balancedArguments(text: string, open: number): string | undefined {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === '"' || ch === "'" || ch === '`') {
      i = endOfString(text, i);
      continue;
    }
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(open + 1, i);
      }
    }
    i += 1;
  }
  return undefined;
}

/** Argument texts of every real (non-comment) `Barretenberg.new(` call; `undefined` if unbalanced. */
export function findNewCalls(text: string): (string | undefined)[] {
  const code = stripComments(text);
  const calls: (string | undefined)[] = [];
  for (const match of code.matchAll(NEW_CALL)) {
    calls.push(balancedArguments(code, match.index + match[0].length - 1));
  }
  return calls;
}

/** Why one call's argument text does not pass `skipSrsInit: true`, or `undefined` if it does. */
function skipSrsInitProblem(args: string | undefined): string | undefined {
  if (args === undefined) {
    return 'call has unbalanced parentheses';
  }
  if (args.includes('...')) {
    return 'call uses a spread, which can override skipSrsInit';
  }
  const uses = [...args.matchAll(/\bskipSrsInit\b/g)];
  if (uses.length === 0) {
    return 'call does not pass skipSrsInit';
  }
  for (const use of uses) {
    if (!SKIP_TRUE.test(args.slice(use.index).trimStart())) {
      return 'skipSrsInit is not the literal true';
    }
  }
  return undefined;
}

/** R1: one message per `Barretenberg.new(` call that does not pass `skipSrsInit: true`. */
export function checkSkipSrsInit(path: string, text: string): string[] {
  const problems: string[] = [];
  findNewCalls(text).forEach((args, index) => {
    const problem = skipSrsInitProblem(args);
    if (problem !== undefined) {
      problems.push(`${path}: Barretenberg.new call #${index + 1}: ${problem}`);
    }
  });
  return problems;
}

/** R2: one message per ceremony host named anywhere in the raw text, comments included. */
export function checkNoCeremonyHosts(path: string, text: string): string[] {
  const lower = text.toLowerCase();
  return CEREMONY_HOSTS.filter((host) => lower.includes(host)).map(
    (host) => `${path}: mentions ceremony host ${host}`,
  );
}

function checkFile(file: SourceFile): string[] {
  return [...checkSkipSrsInit(file.path, file.text), ...checkNoCeremonyHosts(file.path, file.text)];
}

/** Every `.ts` / `.tsx` file under `dir`, recursively, skipping `artifacts/` (data, not code). */
function listCodeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== SKIPPED_DIRECTORY) {
        found.push(...listCodeFiles(full));
      }
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found.sort();
}

function readSrcZk(): SourceFile[] {
  return listCodeFiles(SRC_ZK_DIR).map((full) => ({
    path: relative(SRC_ZK_DIR, full),
    text: readFileSync(full, 'utf8'),
  }));
}

describe('srs wiring: real files under src/zk (Requirement 14.7)', () => {
  const files = readSrcZk();

  it('scans the code files and skips artifacts/', () => {
    const paths = files.map((file) => file.path);
    expect(paths).toContain('prover.ts');
    expect(paths.filter((path) => path.startsWith(`${SKIPPED_DIRECTORY}/`))).toEqual([]);
  });

  it('finds at least one real Barretenberg.new call in prover.ts', () => {
    const prover = files.find((file) => file.path === 'prover.ts');
    expect(prover).toBeDefined();
    expect(findNewCalls(prover?.text ?? '').length).toBeGreaterThanOrEqual(1);
  });

  it('every Barretenberg.new call under src/zk passes skipSrsInit: true', () => {
    const problems = files.flatMap((file) => checkSkipSrsInit(file.path, file.text));
    expect(problems).toEqual([]);
  });

  it('no file under src/zk names a ceremony host', () => {
    const problems = files.flatMap((file) => checkNoCeremonyHosts(file.path, file.text));
    expect(problems).toEqual([]);
  });

  it('the clean real text of prover.ts is accepted', () => {
    const prover = files.find((file) => file.path === 'prover.ts');
    expect(checkFile(prover ?? { path: 'prover.ts', text: '' })).toEqual([]);
  });
});

describe('srs wiring: negative controls on in-memory text', () => {
  const rejected: readonly (readonly [string, string])[] = [
    [
      'option missing',
      'const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1 });',
    ],
    ['skipSrsInit: false', 'const api = await Barretenberg.new({ skipSrsInit: false });'],
    ['expression instead of the literal true', 'const api = await Barretenberg.new({ skipSrsInit: flag });'],
    ['conditional expression starting with true', 'await Barretenberg.new({ skipSrsInit: true ? a : b });'],
    ['argument is a variable', 'const api = await Barretenberg.new(opts);'],
    ['no argument at all', 'const api = await Barretenberg.new();'],
    ['spread can override the option', 'await Barretenberg.new({ skipSrsInit: true, ...opts });'],
    ['second call lacks the option', 'await Barretenberg.new({ skipSrsInit: true });\nawait Barretenberg.new({ threads: 1 });'],
    ['BarretenbergSync, empty object', 'const api = await BarretenbergSync.new({ });'],
    ['option only inside a comment', 'await Barretenberg.new({ threads: 1 /* skipSrsInit: true */ });'],
    ['option only after the call', 'await Barretenberg.new({ threads: 1 }); const o = { skipSrsInit: true };'],
  ];

  it.each(rejected)('R1 rejects: %s', (_name, text) => {
    expect(checkSkipSrsInit('mutated.ts', text).length).toBeGreaterThanOrEqual(1);
  });

  it('R1 rejects an unbalanced call', () => {
    expect(checkSkipSrsInit('mutated.ts', 'await Barretenberg.new({ skipSrsInit: true }')).toHaveLength(1);
  });

  const accepted: readonly (readonly [string, string])[] = [
    [
      'the real call shape',
      'await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });',
    ],
    [
      'a call split across lines',
      'await Barretenberg.new(\n  {\n    backend: BackendType.Wasm,\n    skipSrsInit:\n      true,\n    threads: 1,\n  },\n);',
    ],
    ['skipSrsInit last, no trailing comma', 'await Barretenberg.new({ threads: 1, skipSrsInit: true})'],
    ['BarretenbergSync with the option', 'await BarretenbergSync.new({ skipSrsInit: true });'],
    ['a comment-only mention (not a call)', '// Barretenberg.new({ })\n/* Barretenberg.new(opts) */\nconst x = 1;'],
    ['a doc comment naming the option without a call', '/** `Barretenberg.new` needs skipSrsInit: true. */\nconst x = 1;'],
    ['no call at all', 'export const x = 1;'],
  ];

  it.each(accepted)('R1 accepts: %s', (_name, text) => {
    expect(checkSkipSrsInit('mutated.ts', text)).toEqual([]);
  });

  it('R1 counts a real call and ignores a commented-out one', () => {
    const text = [
      '// await Barretenberg.new({ });',
      'await Barretenberg.new({ skipSrsInit: true });',
      '/* await Barretenberg.new({ }); */',
    ].join('\n');
    expect(findNewCalls(text)).toHaveLength(1);
    expect(checkSkipSrsInit('mutated.ts', text)).toEqual([]);
  });

  it('R1 does not read a // inside a string as a comment', () => {
    const text = 'const u = "http://x"; await Barretenberg.new({ threads: 1 });';
    expect(findNewCalls(text)).toHaveLength(1);
    expect(checkSkipSrsInit('mutated.ts', text)).toHaveLength(1);
  });

  it('R1 on the real prover.ts text rejects it once the option is removed', () => {
    const prover = readSrcZk().find((file) => file.path === 'prover.ts');
    const mutated = (prover?.text ?? '').replace(', skipSrsInit: true', '');
    expect(mutated).not.toBe(prover?.text);
    expect(checkSkipSrsInit('prover.ts', mutated).length).toBeGreaterThanOrEqual(1);
  });

  it.each(CEREMONY_HOSTS)('R2 rejects a string containing %s', (host) => {
    expect(checkNoCeremonyHosts('mutated.ts', `const u = "https://${host}/g1.dat";`)).toHaveLength(1);
  });

  it.each(CEREMONY_HOSTS)('R2 rejects a comment mentioning %s', (host) => {
    expect(checkNoCeremonyHosts('mutated.ts', `// fetched from ${host}`)).toHaveLength(1);
  });

  it('R2 accepts text without a ceremony host', () => {
    expect(checkNoCeremonyHosts('mutated.ts', 'const u = "/samples/g1.dat";')).toEqual([]);
  });
});
