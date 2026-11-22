import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/strip-comments';

// Test ledger_static_scan (ledger-format Requirements 3.4, 3.5, 4.8, 5.1, 5.3, example, one run).
//
// Source scans. Code rules run on comment-stripped text, so a comment that names a forbidden word
// does not fail the scan. The statements about seeded salts are scanned on raw text, because they
// live in comments. Failure messages hold file paths only.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEDGER_DIR = join(REPO_ROOT, 'src', 'ledger');
const ZK_DIR = join(REPO_ROOT, 'src', 'zk');
const BATCH_ROOT_FILE = join(ZK_DIR, 'batch-root.ts');
const FIELD_FILE = join(LEDGER_DIR, 'field.ts');
const GENERATE_FILE = join(LEDGER_DIR, 'generate.ts');
const KEY_README = join(REPO_ROOT, 'scripts', 'demo-key', 'README.md');

/** The `.ts` files directly inside `dir`. */
function listTs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(dir, name));
}

function toRepoPath(file: string): string {
  return relative(REPO_ROOT, file);
}

/** Module specifiers of `import ... from 'x'`, `export ... from 'x'`, `import 'x'` and `import('x')`. */
function importSpecifiers(code: string): string[] {
  const out: string[] = [];
  const patterns = [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]/g];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) out.push(match[1] ?? '');
  }
  return out;
}

describe('ledger_static_scan', () => {
  it('ledger_static_scan: src/ledger has no float parsing, logging, network API or literal copy of 2^40', () => {
    const rules: readonly { readonly name: string; readonly pattern: RegExp }[] = [
      { name: 'parseFloat', pattern: /\bparseFloat\b/ },
      { name: 'parseInt', pattern: /\bparseInt\b/ },
      { name: 'console.', pattern: /\bconsole\s*\./ },
      { name: 'fetch', pattern: /\bfetch\b/ },
      { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
      { name: 'WebSocket', pattern: /\bWebSocket\b/ },
      { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
      { name: '2^40 as 1099511627776', pattern: /1099511627776/ },
      { name: '2^40 as 2n ** 40n', pattern: /\b2n?\s*\*\*\s*40n?\b/ },
      { name: '2^40 as 1n << 40n', pattern: /\b1n?\s*<<\s*40n?\b/ },
    ];
    const files = listTs(LEDGER_DIR);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const { name, pattern } of rules) {
        // `field.ts` is the one place that defines the bound (`AMOUNT_BOUND_CENTS = 2n ** 40n`),
        // so the 2^40 rules skip it. Every other file takes the bound from there.
        if (file === FIELD_FILE && name.startsWith('2^40')) continue;
        if (pattern.test(code)) offenders.push(`${toRepoPath(file)} ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ledger_static_scan: src/ledger imports nothing from src/zk or src/ui', () => {
    const offenders: string[] = [];
    for (const file of listTs(LEDGER_DIR)) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const specifier of importSpecifiers(code)) {
        if (specifier.includes('/zk/') || specifier.includes('../zk') || specifier.includes('../ui')) {
          offenders.push(`${toRepoPath(file)} imports a zk or ui module`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ledger_static_scan: posting.ts and field.ts live in src/ledger and not in src/zk, and src/zk imports them from src/ledger', () => {
    expect(existsSync(join(ZK_DIR, 'posting.ts'))).toBe(false);
    expect(existsSync(join(ZK_DIR, 'field.ts'))).toBe(false);
    expect(existsSync(join(LEDGER_DIR, 'posting.ts'))).toBe(true);
    expect(existsSync(join(LEDGER_DIR, 'field.ts'))).toBe(true);

    // No file in src/zk reaches the two files through a sibling path.
    const offenders: string[] = [];
    for (const file of listTs(ZK_DIR)) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const specifier of importSpecifiers(code)) {
        if (/^\.\/(?:posting|field)(?:\.ts)?$/.test(specifier)) offenders.push(`${toRepoPath(file)} imports a sibling posting or field`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ledger_static_scan: src/zk/batch-root.ts imports Batch from src/ledger and has no hash, padding or leaf-encoding code of its own', () => {
    const code = stripComments(readFileSync(BATCH_ROOT_FILE, 'utf8'));
    for (const word of ['hashLeaf', 'hashNode', 'leafInputs', 'PADDING_POSTING']) {
      expect(code.includes(word)).toBe(false);
    }
    expect(importSpecifiers(code).some((specifier) => /\.\.\/ledger\/batch$/.test(specifier))).toBe(true);
  });

  it('ledger_static_scan: generate.ts and scripts/demo-key/README.md say that seeded salts are not random', () => {
    for (const file of [GENERATE_FILE, KEY_README]) {
      const text = readFileSync(file, 'utf8');
      expect(/seeded salts/i.test(text)).toBe(true);
      expect(/not random/i.test(text)).toBe(true);
    }
  });
});
