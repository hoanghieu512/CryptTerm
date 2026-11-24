// Scan helper for csp_matches_build (release Requirement 2.2). It derives, from the text of the
// built files, the sources the app needs, and compares them with the CSP. It reports a need the
// CSP does not grant. A grant that nothing uses is never reported. Read-only, no network.
// Failure messages hold directive and source names only, never file contents.

export interface CspNeed {
  readonly directive: string;
  readonly source: string;
  readonly why: string;
}

export interface BuiltFile {
  readonly name: string;
  readonly text: string;
}

const EXTERNAL = /^https?:\/\//i;

/** Origin of an absolute http(s) URL, or the text itself when it does not parse. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function htmlNeeds(text: string): CspNeed[] {
  const needs: CspNeed[] = [];
  if (/<style[\s>]/i.test(text)) needs.push({ directive: 'style-src', source: "'unsafe-inline'", why: 'style element in html' });
  if (/\sstyle\s*=/i.test(text)) needs.push({ directive: 'style-src', source: "'unsafe-inline'", why: 'style attribute in html' });
  if (/<script(?![^>]*\ssrc\s*=)[^>]*>/i.test(text)) {
    needs.push({ directive: 'script-src', source: "'unsafe-inline'", why: 'inline script in html' });
  }
  if (/<img[\s>]/i.test(text)) needs.push({ directive: 'img-src', source: "'self'", why: 'img element in html' });
  if (/<link[^>]*\srel\s*=\s*["']?[^"'>]*icon/i.test(text)) {
    needs.push({ directive: 'img-src', source: "'self'", why: 'icon link in html' });
  }
  for (const match of text.matchAll(/<(script|link|img|iframe|source)\b[^>]*?\s(?:src|href)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi)) {
    const tag = (match[1] ?? '').toLowerCase();
    const directive = tag === 'script' ? 'script-src' : tag === 'link' ? 'style-src' : tag === 'img' ? 'img-src' : 'default-src';
    needs.push({ directive, source: originOf(match[2] ?? ''), why: `external ${tag} in html` });
  }
  return needs;
}

function cssNeeds(text: string): CspNeed[] {
  const needs: CspNeed[] = [];
  for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)/gi)) {
    const target = match[1] ?? '';
    if (/^data:/i.test(target)) needs.push({ directive: 'img-src', source: 'data:', why: 'data url in css' });
    else if (/^blob:/i.test(target)) needs.push({ directive: 'img-src', source: 'blob:', why: 'blob url in css' });
    else if (EXTERNAL.test(target)) needs.push({ directive: 'img-src', source: originOf(target), why: 'external url in css' });
    else needs.push({ directive: 'img-src', source: "'self'", why: 'url() in css' });
  }
  for (const match of text.matchAll(/@import\s+(?:url\()?\s*["']?(https?:\/\/[^"')\s;]+)/gi)) {
    needs.push({ directive: 'style-src', source: originOf(match[1] ?? ''), why: 'external @import in css' });
  }
  return needs;
}

function scriptNeeds(text: string): CspNeed[] {
  const needs: CspNeed[] = [];
  if (/<style[\s>]/i.test(text)) needs.push({ directive: 'style-src', source: "'unsafe-inline'", why: 'style element in script' });
  if (/setAttribute\(\s*[`'"]style[`'"]/.test(text) || /\.cssText\b/.test(text)) {
    needs.push({ directive: 'style-src', source: "'unsafe-inline'", why: 'inline style written by script' });
  }
  if (/\beval\(|new Function\(/.test(text)) needs.push({ directive: 'script-src', source: "'unsafe-eval'", why: 'eval in script' });
  if (/data:image\//i.test(text)) needs.push({ directive: 'img-src', source: 'data:', why: 'data image in script' });
  if (/new Image\(|createElement\(\s*[`'"]img[`'"]/.test(text)) {
    needs.push({ directive: 'img-src', source: "'self'", why: 'image created by script' });
  }
  if (/new Worker\(\s*[`'"]blob:/.test(text)) needs.push({ directive: 'worker-src', source: 'blob:', why: 'blob worker' });
  for (const match of text.matchAll(/(?:fetch|new Worker|new WebSocket|new EventSource|importScripts|sendBeacon)\(\s*[`'"](https?:\/\/[^`'"]+|wss?:\/\/[^`'"]+)/g)) {
    needs.push({ directive: 'connect-src', source: originOf((match[1] ?? '').replace(/^ws/, 'http')), why: 'literal external request in script' });
  }
  return needs;
}

/** The needs of a set of built files. The kind of each file comes from its extension. */
export function needsOf(files: readonly BuiltFile[]): CspNeed[] {
  const needs: CspNeed[] = [];
  for (const file of files) {
    if (file.name.endsWith('.html')) needs.push(...htmlNeeds(file.text));
    else if (file.name.endsWith('.css')) needs.push(...cssNeeds(file.text));
    else if (file.name.endsWith('.js')) needs.push(...scriptNeeds(file.text));
  }
  return needs;
}

/** Directive name to its source list, from the text of a CSP header value. */
export function parseCsp(value: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const words = part.trim().split(/\s+/).filter((word) => word.length > 0);
    const [name, ...sources] = words;
    if (name !== undefined) out.set(name, sources);
  }
  return out;
}

/** True when the CSP grants the need. A directive that is absent falls back to `default-src`. */
export function isGranted(csp: ReadonlyMap<string, readonly string[]>, need: CspNeed): boolean {
  const list = csp.get(need.directive) ?? csp.get('default-src') ?? [];
  return list.includes(need.source) || list.includes('*');
}

/** Needs the CSP does not grant, as `directive source (why)` lines. */
export function ungrantedNeeds(cspValue: string, files: readonly BuiltFile[]): string[] {
  const csp = parseCsp(cspValue);
  return needsOf(files)
    .filter((need) => !isGranted(csp, need))
    .map((need) => `${need.directive} ${need.source} (${need.why})`);
}
