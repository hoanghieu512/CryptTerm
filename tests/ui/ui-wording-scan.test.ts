import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, listFiles, repoPath } from '../support/fs-walk';

// Test ui_wording_scan (terminal-ui Requirement 9.3, example, one run).
//
// Two scans. First, the words that must not appear: the company name and the model number of the
// block-mode terminal vendor, in `src`, `index.html`, `public` (except `samples` and `_redirects`)
// and `README.md`. Only text files are read, because a binary or base64 asset can hold any letters
// by chance. Second, no resource URL from another origin in `index.html`, in the stylesheets
// under `src`, and (when CHECK_DIST=1, after `npm run build`) in `dist/index.html`.
//
// The forbidden words are built from parts so that this file does not hold them as one string.
// Failure messages hold repo paths and rule names only.

const BANNED: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'company name', pattern: new RegExp(`\\b${'I'}${'B'}${'M'}\\b`, 'i') },
  { name: 'model number', pattern: new RegExp(`${'32'}${'70'}`) },
];

const TEXT_FILE = /\.(?:ts|tsx|js|mjs|css|html|md|txt|toml|webmanifest|svg)$/;
const INDEX_HTML = join(REPO_ROOT, 'index.html');
const DIST_INDEX = join(REPO_ROOT, 'dist', 'index.html');

function wordingTargets(): string[] {
  const publicDir = join(REPO_ROOT, 'public');
  const inPublic = listFiles(publicDir).filter((file) => {
    const rel = file.slice(publicDir.length + 1);
    return !rel.startsWith('samples/') && rel !== '_redirects';
  });
  const files = [...listFiles(join(REPO_ROOT, 'src')), INDEX_HTML, ...inPublic, join(REPO_ROOT, 'README.md')];
  return files.filter((file) => TEXT_FILE.test(file) && existsSync(file));
}

function bannedWords(file: string, text: string): string[] {
  return BANNED.filter((rule) => rule.pattern.test(text)).map((rule) => `${repoPath(file)} ${rule.name}`);
}

// An attribute value or CSS url() that points at another origin: http(s):// or protocol-relative.
const EXTERNAL_ATTRIBUTE = /\b(?:src|href|srcset|poster|data|action|formaction)\s*=\s*["']?\s*(?:https?:)?\/\//i;
const EXTERNAL_CSS_URL = /url\(\s*["']?\s*(?:https?:)?\/\//i;
const CSS_IMPORT = /@import\b/i;

function externalResources(file: string, text: string): string[] {
  const hits: string[] = [];
  if (EXTERNAL_ATTRIBUTE.test(text)) hits.push(`${repoPath(file)} external attribute URL`);
  if (EXTERNAL_CSS_URL.test(text)) hits.push(`${repoPath(file)} external css url()`);
  if (CSS_IMPORT.test(text)) hits.push(`${repoPath(file)} @import`);
  return hits;
}

describe('ui_wording_scan', () => {
  it('ui_wording_scan: src, index.html, public (except samples and _redirects) and README.md name neither the company nor the model number', () => {
    const files = wordingTargets();
    expect(files.map(repoPath)).toContain('index.html');
    expect(files.map(repoPath)).toContain('README.md');
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.flatMap((file) => bannedWords(file, readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('ui_wording_scan: index.html and the stylesheets under src load nothing from another origin', () => {
    const html = readFileSync(INDEX_HTML, 'utf8');
    expect(html.includes('<script')).toBe(true);
    const sheets = listFiles(join(REPO_ROOT, 'src')).filter((file) => file.endsWith('.css'));
    const offenders = [INDEX_HTML, ...sheets].flatMap((file) => externalResources(file, readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('ui_wording_scan: the scans fire on planted words and URLs and stay silent on same-origin links', () => {
    const probe = join(REPO_ROOT, 'index.html');
    const company = ['I', 'B', 'M'].join('');
    const model = ['32', '70'].join('');
    expect(bannedWords(probe, `<title>${company} terminal</title>`)).toHaveLength(1);
    expect(bannedWords(probe, `emulates the ${model}`)).toHaveLength(1);
    expect(bannedWords(probe, 'block-mode terminal, CTM300')).toEqual([]);
    expect(bannedWords(probe, `${company}x and a${company}`)).toEqual([]);
    expect(externalResources(probe, '<script src="https://cdn.example/x.js"></script>')).toHaveLength(1);
    expect(externalResources(probe, '<link rel="stylesheet" href="//fonts.example/a.css">')).toHaveLength(1);
    expect(externalResources(probe, 'body { background: url(http://x.example/a.png) }')).toHaveLength(1);
    expect(externalResources(probe, '@import "other.css";')).toHaveLength(1);
    expect(externalResources(probe, '<script type="module" src="/src/main.tsx"></script>')).toEqual([]);
    expect(externalResources(probe, '<a href="/verify#b=abc">link</a>')).toEqual([]);
  });

  it.runIf(process.env['CHECK_DIST'] === '1')(
    'ui_wording_scan: the built dist/index.html loads nothing from another origin',
    () => {
      expect(existsSync(DIST_INDEX)).toBe(true);
      expect(externalResources(DIST_INDEX, readFileSync(DIST_INDEX, 'utf8'))).toEqual([]);
    },
  );
});
