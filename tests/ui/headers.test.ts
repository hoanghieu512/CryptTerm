import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headersFor } from '../../scripts/parse-headers';
import config from '../../vite.config';
import { listFiles, REPO_ROOT } from '../support/fs-walk';
import { parseCsp, ungrantedNeeds, type BuiltFile } from '../support/csp-needs';

// Tests headers_file_policy, preview_headers_from_file and csp_matches_build (release
// Requirement 2.1, 2.2, 2.4, 2.5). The headers file is the one copy of the policy. The build check
// needs a build, so it runs only when CHECK_DIST=1.

const HEADERS_TEXT = readFileSync(join(REPO_ROOT, 'public', '_headers'), 'utf8');
const CSP_KEY = 'Content-Security-Policy';

const FIXED_DIRECTIVES: Readonly<Record<string, string>> = {
  'default-src': "'self'",
  'script-src': "'self' 'wasm-unsafe-eval'",
  'worker-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'none'",
  'frame-ancestors': "'none'",
  'form-action': "'none'",
};

describe('headers file', () => {
  it('headers_file_policy: the /* block holds the fixed CSP directives and the two extra headers, and no COOP or COEP', () => {
    const headers = headersFor('/*', HEADERS_TEXT);
    const csp = parseCsp(headers[CSP_KEY] ?? '');
    for (const [directive, sources] of Object.entries(FIXED_DIRECTIVES)) {
      expect(csp.get(directive)?.join(' '), directive).toBe(sources);
    }
    // connect-src: `data:` is inline content and reaches no origin; bb.js fetches its embedded WASM from it.
    // Nothing else is allowed: no http, https, ws or wss origin, no wildcard, no blob:.
    expect([...(csp.get('connect-src') ?? [])].sort(), 'connect-src').toEqual(["'self'", 'data:']);
    expect(csp.get('style-src')?.length ?? 0).toBeGreaterThan(0);
    expect(["'none'", "'self'"]).toContain(csp.get('img-src')?.join(' '));
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    const names = Object.keys(headers).map((name) => name.toLowerCase());
    expect(names).not.toContain('cross-origin-opener-policy');
    expect(names).not.toContain('cross-origin-embedder-policy');
    expect(HEADERS_TEXT.toLowerCase()).not.toContain('cross-origin-');
  });

  it('headers_file_policy: the parser reads one block, skips comments and throws without the block', () => {
    const text = '# note\n/a\n  X-One: 1\n\n/*\n  X-Two: 2\n  # inner\n  X-Two: 3\n';
    expect(headersFor('/*', text)).toEqual({ 'X-Two': '2, 3' });
    expect(headersFor('/a', text)).toEqual({ 'X-One': '1' });
    expect(() => headersFor('/*', '/a\n  X-One: 1\n')).toThrow('HEADERS: NO /* BLOCK');
    expect(() => headersFor('/*', '/*\n  broken line\n')).toThrow('HEADERS: MALFORMED LINE UNDER /*');
  });

  it('preview_headers_from_file: preview.headers equals the parsed file, and vite.config.ts holds no second copy', () => {
    expect(config.preview?.headers).toEqual(headersFor('/*', HEADERS_TEXT));
    const configText = readFileSync(join(REPO_ROOT, 'vite.config.ts'), 'utf8');
    for (const needle of [CSP_KEY, 'Referrer-Policy', 'nosniff', "default-src 'self'"]) {
      expect(configText.includes(needle), needle).toBe(false);
    }
  });
});

describe('csp scan helper', () => {
  const CSP = headersFor('/*', HEADERS_TEXT)[CSP_KEY] ?? '';
  const html = (text: string): BuiltFile => ({ name: 'index.html', text });

  it('csp_matches_build: finds a need the CSP does not grant', () => {
    const cases: ReadonlyArray<readonly [BuiltFile, string]> = [
      [html('<style>a{}</style>'), 'style-src'],
      [html('<p style="color:red">'), 'style-src'],
      [html('<script>1</script>'), 'script-src'],
      [{ name: 'a.css', text: 'a{background:url(data:image/png;base64,AA)}' }, 'img-src'],
      [{ name: 'a.css', text: '@import "https://fonts.example.org/a.css";' }, 'style-src'],
      [{ name: 'a.js', text: 'fetch("https://example.org/x")' }, 'connect-src'],
      [{ name: 'a.js', text: 'eval("1")' }, 'script-src'],
    ];
    for (const [file, directive] of cases) {
      const found = ungrantedNeeds(CSP, [file]);
      expect(found.length, file.text).toBeGreaterThan(0);
      expect(found.every((line) => line.startsWith(directive)), file.text).toBe(true);
    }
  });

  it('csp_matches_build: a grant that nothing uses does not fail', () => {
    const wide = `${CSP}; font-src 'self' data:`;
    const clean: BuiltFile[] = [
      html('<script type="module" crossorigin src="/assets/a.js"></script><link rel="stylesheet" href="/assets/a.css">'),
      { name: 'a.js', text: 'fetch(`/samples/x`);new Worker(new URL(`/assets/w.js`,import.meta.url))' },
      { name: 'a.css', text: 'a{color:red}' },
    ];
    expect(ungrantedNeeds(CSP, clean)).toEqual([]);
    expect(ungrantedNeeds(wide, clean)).toEqual([]);
  });
});

describe('built output', () => {
  const distIt = process.env.CHECK_DIST === '1' ? it : it.skip;

  distIt('csp_matches_build: the built dist needs no source that the CSP does not grant', () => {
    const dist = join(REPO_ROOT, 'dist');
    const files = listFiles(dist)
      .filter((file) => /\.(html|css|js)$/.test(file))
      .map((file) => ({ name: file, text: readFileSync(file, 'utf8') }));
    expect(files.length).toBeGreaterThan(0);
    expect(ungrantedNeeds(cspOfDist(dist), files)).toEqual([]);
  });
});

/** The CSP of the copy of the headers file that the build wrote into dist, so the check covers what ships. */
function cspOfDist(dist: string): string {
  const value = headersFor('/*', readFileSync(join(dist, '_headers'), 'utf8'))[CSP_KEY];
  expect(value, 'dist/_headers CSP').toBeTypeOf('string');
  return value ?? '';
}
