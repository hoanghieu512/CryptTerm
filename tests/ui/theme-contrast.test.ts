import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCANLINE_ALPHA, THEME, contrastRatio } from '../../src/ui/theme';
import { REPO_ROOT } from '../support/fs-walk';
import { declaration, parseCss } from '../support/css-rules';
import type { CssRule } from '../support/css-rules';

// Test theme_contrast (terminal-ui Requirements 9.4 and 9.5, example, one run).
//
// Shape this test expects from `src/ui/theme.ts` (design section I):
//   THEME.palette.ground   page and screen ground, `#rrggbb`
//   THEME.palette.text     normal text colour
//   THEME.palette.dim      dim text colour
//   THEME.palette.inverse  text colour of the inverse-video header and status line, drawn on `text`
//   SCANLINE_ALPHA         opacity of the black scanline layer, 0 < alpha < 1
//   contrastRatio(a, b)    WCAG 2 contrast ratio of two `#rrggbb` colours
// The ratios are recomputed here with an independent WCAG implementation, so a palette change that
// drops below 4.5 fails, and a wrong `contrastRatio` fails against the same numbers.

const MIN_RATIO = 4.5;
const STYLESHEET = join(REPO_ROOT, 'src', 'ui', 'terminal.css');
const REDUCE_MOTION = '@media (prefers-reduced-motion: reduce)';

type Rgb = readonly [number, number, number];

function rgbOf(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error('THEME COLOUR NOT #rrggbb');
  return [parseInt(m[1] ?? '', 16), parseInt(m[2] ?? '', 16), parseInt(m[3] ?? '', 16)];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A colour under a black layer of opacity `alpha`. */
function darkened([r, g, b]: Rgb, alpha: number): Rgb {
  const f = (c: number): number => Math.round(c * (1 - alpha));
  return [f(r), f(g), f(b)];
}

const { ground, text, dim, inverse } = THEME.palette;
const GROUND = rgbOf(ground);
const TEXT = rgbOf(text);
const DIM = rgbOf(dim);
const INVERSE = rgbOf(inverse);

describe('theme_contrast', () => {
  it('theme_contrast: text, dim text and inverse text reach 4.5 to 1 on their ground and match the design table', () => {
    expect(ratio(TEXT, GROUND)).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(ratio(DIM, GROUND)).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(ratio(INVERSE, TEXT)).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(ratio(TEXT, GROUND)).toBeCloseTo(14.4, 0);
    expect(ratio(DIM, GROUND)).toBeCloseTo(8.0, 0);
    expect(ratio(INVERSE, TEXT)).toBeCloseTo(14.6, 0);
  });

  it('theme_contrast: contrastRatio agrees with the independent WCAG computation', () => {
    for (const [a, b] of [
      [text, ground],
      [dim, ground],
      [inverse, text],
      ['#000000', '#ffffff'],
    ] as const) {
      expect(contrastRatio(a, b)).toBeCloseTo(ratio(rgbOf(a), rgbOf(b)), 6);
      expect(contrastRatio(b, a)).toBeCloseTo(contrastRatio(a, b), 6);
    }
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
  });

  it('theme_contrast: the scanline layer keeps every text colour at 4.5 to 1 or more', () => {
    expect(SCANLINE_ALPHA).toBeGreaterThan(0);
    expect(SCANLINE_ALPHA).toBeLessThan(1);
    const underLines = (c: Rgb): Rgb => darkened(c, SCANLINE_ALPHA);
    for (const [name, fg] of [['text', TEXT], ['dim', DIM]] as const) {
      // Darkened text on the plain ground (the design table), and on a darkened ground.
      expect(ratio(underLines(fg), GROUND), `${name} on ground`).toBeGreaterThanOrEqual(MIN_RATIO);
      expect(ratio(underLines(fg), underLines(GROUND)), `${name} on darkened ground`).toBeGreaterThanOrEqual(MIN_RATIO);
    }
    expect(ratio(underLines(INVERSE), underLines(TEXT)), 'inverse').toBeGreaterThanOrEqual(MIN_RATIO);
    expect(ratio(underLines(TEXT), GROUND)).toBeCloseTo(8.0, 0);
  });

  it('theme_contrast: terminal.css has a reduced-motion block that sets animation: none for every animated rule', () => {
    const rules = parseCss(readFileSync(STYLESHEET, 'utf8'));
    const plain = rules.filter((r) => r.within === null && !r.selector.startsWith('@'));
    const reduced = rules.filter((r) => r.within === REDUCE_MOTION);
    expect(reduced.length).toBeGreaterThan(0);

    const animated = plain.filter((r) => {
      const value = declaration(r.body, 'animation') ?? declaration(r.body, 'animation-name');
      return value !== null && value !== 'none';
    });
    expect(animated.length).toBeGreaterThan(0);

    const disables = (r: CssRule): boolean =>
      declaration(r.body, 'animation') === 'none' || declaration(r.body, 'animation-name') === 'none';
    const coversAll = reduced.some((r) => disables(r) && r.selector.split(',').some((s) => s.trim() === '*'));
    if (!coversAll) {
      const uncovered = animated.filter(
        (a) => !reduced.some((r) => disables(r) && r.selector.split(',').some((s) => a.selector.split(',').some((t) => t.trim() === s.trim()))),
      );
      expect(uncovered.map((r) => r.selector)).toEqual([]);
    }
  });

  it('theme_contrast: the scanline and glow layers exist and never take pointer events', () => {
    const rules = parseCss(readFileSync(STYLESHEET, 'utf8'));
    const layers = rules.filter((r) => !r.selector.startsWith('@') && /scanline|glow/i.test(r.selector));
    expect(layers.some((r) => /scanline/i.test(r.selector))).toBe(true);
    expect(layers.some((r) => /glow/i.test(r.selector))).toBe(true);
    const open = layers.filter((r) => declaration(r.body, 'pointer-events') !== 'none');
    expect(open.map((r) => r.selector)).toEqual([]);
  });

  it('theme_contrast: the stylesheet reader finds media blocks, comments and declarations', () => {
    const css = '/* c */ .a { animation: blink 1s; } @media (prefers-reduced-motion: reduce) { .a { animation: none !important; } }';
    const rules = parseCss(css);
    expect(rules).toHaveLength(2);
    expect(rules[0]?.within).toBeNull();
    expect(rules[1]?.within).toBe(REDUCE_MOTION);
    expect(declaration(rules[1]?.body ?? '', 'animation')).toBe('none');
    expect(declaration(rules[0]?.body ?? '', 'animation')).toBe('blink 1s');
    expect(declaration(rules[0]?.body ?? '', 'pointer-events')).toBeNull();
  });
});
