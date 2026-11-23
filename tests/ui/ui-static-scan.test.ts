import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, listFiles, repoPath } from '../support/fs-walk';
import { stripComments } from '../support/strip-comments';

// Test ui_static_scan (terminal-ui Requirements 3.5 and 9.1, example, one run).
//
// Source scan over every `.ts` and `.tsx` file under `src/ui`, plus `src/main.tsx`. Rules run on
// comment-stripped text, so a comment that names a forbidden word does not fail the scan. Failure
// messages hold repo paths and rule names only.

const UI_DIR = join(REPO_ROOT, 'src', 'ui');
const MAIN_FILE = join(REPO_ROOT, 'src', 'main.tsx');
const SAMPLE_LOADER = join(UI_DIR, 'sample-loader.ts');
const CTM200 = join(UI_DIR, 'model', 'screens', 'ctm200.ts');

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  // The only files where the rule does not apply.
  readonly exempt?: readonly string[];
}

const RULES: readonly Rule[] = [
  { name: 'console.', pattern: /\bconsole\s*\./ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'importScripts', pattern: /\bimportScripts\b/ },
  { name: 'localStorage', pattern: /\blocalStorage\b/ },
  { name: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { name: 'indexedDB', pattern: /\bindexedDB\b/ },
  { name: 'caches', pattern: /\bcaches\b/ },
  { name: 'document.cookie', pattern: /\bdocument\s*\.\s*cookie\b/ },
  { name: 'parseFloat', pattern: /\bparseFloat\b/ },
  { name: 'parseInt', pattern: /\bparseInt\b/ },
  { name: 'Number(', pattern: /\bNumber\s*\(/ },
  { name: 'dangerouslySetInnerHTML', pattern: /\bdangerouslySetInnerHTML\b/ },
  { name: 'fetch(', pattern: /\bfetch\s*\(/, exempt: [SAMPLE_LOADER] },
  { name: '.account', pattern: /\.\s*account\b|\[\s*['"`]account['"`]\s*\]/, exempt: [CTM200] },
];

function scannedFiles(): string[] {
  const files = listFiles(UI_DIR).filter((file) => /\.tsx?$/.test(file));
  return [...files, MAIN_FILE];
}

function violations(file: string, code: string): string[] {
  return RULES.filter((rule) => rule.pattern.test(code) && !rule.exempt?.includes(file)).map(
    (rule) => `${repoPath(file)} ${rule.name}`,
  );
}

describe('ui_static_scan', () => {
  it('ui_static_scan: the exempt files are the sample loader (fetch) and the CTM200 screen (account)', () => {
    const exemptions = RULES.filter((rule) => rule.exempt !== undefined).map((rule) => [
      rule.name,
      (rule.exempt ?? []).map(repoPath),
    ]);
    expect(exemptions).toStrictEqual([
      ['fetch(', ['src/ui/sample-loader.ts']],
      ['.account', ['src/ui/model/screens/ctm200.ts']],
    ]);
  });

  it('ui_static_scan: src/ui and src/main.tsx have no forbidden name in code', () => {
    const files = scannedFiles();
    expect(files.length).toBeGreaterThan(10);
    expect(files.map(repoPath)).toContain('src/main.tsx');
    const offenders = files.flatMap((file) => violations(file, stripComments(readFileSync(file, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('ui_static_scan: fetch( is called in the sample loader and account is read in the CTM200 screen', () => {
    expect(/\bfetch\s*\(/.test(stripComments(readFileSync(SAMPLE_LOADER, 'utf8')))).toBe(true);
    expect(/\.\s*account\b/.test(stripComments(readFileSync(CTM200, 'utf8')))).toBe(true);
  });

  it('ui_static_scan: each rule fires on code and stays silent in a comment', () => {
    const probe = join(UI_DIR, 'probe.ts');
    const samples: Readonly<Record<string, string>> = {
      'console.': 'console.log(x)',
      XMLHttpRequest: 'new XMLHttpRequest()',
      sendBeacon: 'navigator.sendBeacon(u)',
      WebSocket: 'new WebSocket(u)',
      importScripts: 'importScripts(u)',
      localStorage: 'localStorage.getItem(k)',
      sessionStorage: 'sessionStorage.clear()',
      indexedDB: 'indexedDB.open(n)',
      caches: 'caches.open(n)',
      'document.cookie': 'document.cookie = c',
      parseFloat: 'parseFloat(s)',
      parseInt: 'parseInt(s)',
      'Number(': 'Number(s)',
      dangerouslySetInnerHTML: '<div dangerouslySetInnerHTML={h} />',
      'fetch(': 'await fetch(u)',
      '.account': 'const a = posting.account',
    };
    for (const rule of RULES) {
      const code = samples[rule.name] ?? '';
      expect(violations(probe, stripComments(code)).some((v) => v.endsWith(rule.name))).toBe(true);
      expect(violations(probe, stripComments(`// ${code}\n/* ${code} */`))).toEqual([]);
    }
    expect(violations(SAMPLE_LOADER, stripComments('await fetch(u)'))).toEqual([]);
    expect(violations(CTM200, stripComments('maskAccount(p.account)'))).toEqual([]);
    expect(violations(MAIN_FILE, stripComments("row['account']")).length).toBe(1);
  });
});
