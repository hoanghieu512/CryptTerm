// Minimal CSS rule reader for the terminal-ui stylesheet checks. It handles comments, plain rules
// and one level of at-rule blocks (`@media`, `@keyframes`), which is all `terminal.css` uses.
// It is not a full CSS parser. Pure text function, no file access.

export interface CssRule {
  /** Selector text, trimmed. */
  readonly selector: string;
  /** Declarations between the braces, trimmed. */
  readonly body: string;
  /** The enclosing at-rule prelude (for example `@media (prefers-reduced-motion: reduce)`), or null. */
  readonly within: string | null;
}

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Index of the `}` that closes the `{` at `open`, or -1. */
function closingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    const c = css.charAt(i);
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function readRules(css: string, within: string | null, out: CssRule[]): void {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) return;
    const close = closingBrace(css, open);
    if (close === -1) return;
    const selector = css.slice(i, open).trim();
    const body = css.slice(open + 1, close).trim();
    if (selector.startsWith('@media') || selector.startsWith('@supports')) readRules(body, selector, out);
    else out.push({ selector, body, within });
    i = close + 1;
  }
}

export function parseCss(css: string): CssRule[] {
  const out: CssRule[] = [];
  readRules(stripCssComments(css), null, out);
  return out;
}

/** The value of `property` in a declaration block, lower-cased and without `!important`, or null. */
export function declaration(body: string, property: string): string | null {
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    if (part.slice(0, colon).trim().toLowerCase() !== property) continue;
    return part
      .slice(colon + 1)
      .replace(/!important/i, '')
      .trim()
      .toLowerCase();
  }
  return null;
}
