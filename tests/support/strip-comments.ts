// Comment stripper for the source-scan tests (`ledger_static_scan`, `no_private_key_in_src`).
//
// Pure text function, no file access. It removes `//` and `/* */` comments and keeps string,
// template and regular-expression literals as they are, so a scan for a code word does not
// fire on a comment that mentions it, and a `//` inside a string (a URL) does not eat the line.
// Not a full JavaScript lexer: template literals are copied up to the next unescaped backtick
// without parsing `${ }`. That is enough for the files under `src/`.

const REGEX_PRECEDERS = '(,=:[!&|?{};+-*%<>~^';

function endsWithWord(text: string, word: string): boolean {
  if (!text.endsWith(word)) return false;
  const before = text.charAt(text.length - word.length - 1);
  return before === '' || !/[A-Za-z0-9_$]/.test(before);
}

/** True when a `/` at this point starts a regular expression and not a division. */
function regexAllowed(out: string): boolean {
  const trimmed = out.trimEnd();
  if (trimmed === '') return true;
  const last = trimmed.charAt(trimmed.length - 1);
  if (REGEX_PRECEDERS.includes(last)) return true;
  return endsWithWord(trimmed, 'return') || endsWithWord(trimmed, 'typeof');
}

/** Index just past the closing quote of the string or template that starts at `start`. */
function skipQuoted(src: string, start: number): number {
  const quote = src.charAt(start);
  let i = start + 1;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (c === '\n' && quote !== '`') return i; // unterminated: stop at the line end
    i += 1;
  }
  return i;
}

/** Index just past the closing `/` of the regular expression that starts at `start`. */
function skipRegex(src: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '\n') return i;
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i + 1;
    i += 1;
  }
  return i;
}

export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src.charAt(i);
    const next = src.charAt(i + 1);
    if (c === '/' && next === '/') {
      while (i < src.length && src.charAt(i) !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? src.length : close + 2;
      out += ' ';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const end = skipQuoted(src, i);
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && regexAllowed(out)) {
      const end = skipRegex(src, i);
      out += src.slice(i, end);
      i = end;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}
