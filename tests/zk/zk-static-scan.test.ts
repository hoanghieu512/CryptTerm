import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/strip-comments';

// Test zk_static_scan (zk-core Requirements 3.5, 9.4, 10.1 to 10.4, example, one run).
//
// Source scan over the `.ts` files directly inside `src/zk` and `src/ledger`. Rules run on
// comment-stripped text, so a comment that names a forbidden word does not fail the scan. Failure
// messages hold repo paths and rule names only.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCANNED_DIRS = [join(REPO_ROOT, 'src', 'zk'), join(REPO_ROOT, 'src', 'ledger')];
const BUNDLE_FILE = join(REPO_ROOT, 'src', 'zk', 'bundle.ts');


// The two files whose same-origin loaders may call `fetch` (the guard lives in them).
const FETCH_ALLOWED: readonly string[] = [
  join(REPO_ROOT, 'src', 'zk', 'artifact.ts'),
  join(REPO_ROOT, 'src', 'zk', 'srs.ts'),
];

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  // Files where the rule does not apply.
  readonly exempt?: readonly string[];
}

const RULES: readonly Rule[] = [
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'importScripts', pattern: /\bimportScripts\b/ },
  { name: 'fetch', pattern: /\bfetch\b/, exempt: FETCH_ALLOWED },
  { name: 'console.', pattern: /\bconsole\s*\./ },
  { name: 'localStorage', pattern: /\blocalStorage\b/ },
  { name: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { name: 'indexedDB', pattern: /\bindexedDB\b/ },
  { name: 'caches', pattern: /\bcaches\b/ },
  { name: 'document.cookie', pattern: /\bdocument\s*\.\s*cookie\b/ },
  { name: 'parseFloat', pattern: /\bparseFloat\b/ },
  { name: 'parseInt', pattern: /\bparseInt\b/ },
];

function listTs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(dir, name));
}

function scannedFiles(): string[] {
  return SCANNED_DIRS.flatMap(listTs);
}

function violations(file: string, code: string): string[] {
  return RULES.filter((rule) => rule.pattern.test(code) && !rule.exempt?.includes(file)).map(
    (rule) => `${relative(REPO_ROOT, file)} ${rule.name}`,
  );
}

describe('zk_static_scan', () => {
  it('zk_static_scan: the fetch exemption holds only the two same-origin loaders', () => {
    expect(FETCH_ALLOWED.map((file) => file.split('/').pop())).toStrictEqual(['artifact.ts', 'srs.ts']);
  });

  it('zk_static_scan: src/zk and src/ledger have no network, console, storage or float-parse call in code', () => {
    const files = scannedFiles();
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) => violations(file, stripComments(readFileSync(file, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('zk_static_scan: each rule fires on code and stays silent in a comment', () => {
    const probe = join(REPO_ROOT, 'src', 'zk', 'probe.ts');
    const samples: Readonly<Record<string, string>> = {
      XMLHttpRequest: 'new XMLHttpRequest()',
      sendBeacon: 'navigator.sendBeacon(u)',
      WebSocket: 'new WebSocket(u)',
      importScripts: 'importScripts(u)',
      fetch: 'await fetch(u)',
      'console.': 'console.log(x)',
      localStorage: 'localStorage.getItem(k)',
      sessionStorage: 'sessionStorage.clear()',
      indexedDB: 'indexedDB.open(n)',
      caches: 'caches.open(n)',
      'document.cookie': 'document.cookie = c',
      parseFloat: 'parseFloat(s)',
      parseInt: 'parseInt(s)',
    };
    for (const rule of RULES) {
      const code = samples[rule.name] ?? '';
      expect(violations(probe, stripComments(code)).some((v) => v.endsWith(rule.name))).toBe(true);
      expect(violations(probe, stripComments(`// ${code}\n/* ${code} */`))).toEqual([]);
    }
    expect(violations(FETCH_ALLOWED[0] ?? '', stripComments('await fetch(u)'))).toEqual([]);
  });

  it('zk_static_scan: bundle.ts has no identifier with verification_key other than verification_key_hash', () => {
    const code = stripComments(readFileSync(BUNDLE_FILE, 'utf8'));
    const found = code.match(/[A-Za-z0-9_$]*verification_?key[A-Za-z0-9_$]*/gi) ?? [];
    expect(found.filter((name) => name !== 'verification_key_hash')).toEqual([]);
  });
});
