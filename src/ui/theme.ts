// The one place for the look of the block-mode terminal (terminal-ui design, section I): colours,
// font stack and grid metrics. `terminal-view.tsx` turns these values into CSS variables, and
// `terminal.css` only reads the variables, so a palette change is made here and nowhere else.
//
// Colours are `#rrggbb`. `contrastRatio` is the WCAG 2 formula on sRGB. `theme_contrast` checks
// every text colour against its ground, with and without the scanline layer.

export interface Palette {
  /** Ground of the page and of the screen. */
  readonly ground: string;
  /** Normal text: phosphor green. */
  readonly text: string;
  /** Dim text (PF bar, hints). */
  readonly dim: string;
  /** Text of the inverse-video header and status line, drawn on `text`. */
  readonly inverse: string;
}

export interface Theme {
  readonly palette: Palette;
  readonly fontStack: string;
  /** Unitless line height of one grid row. */
  readonly lineHeight: number;
  /** The grid is `cols` characters wide and `rows` rows high. */
  readonly cols: number;
  readonly rows: number;
}

export const THEME: Theme = Object.freeze({
  palette: Object.freeze({
    ground: '#07110a',
    text: '#3dff7a',
    dim: '#2fbf5f',
    inverse: '#031006',
  }),
  // Local fonts only: no web font is loaded.
  fontStack: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  lineHeight: 1.3,
  cols: 80,
  rows: 24,
});

/** Opacity of the black scanline layer. Kept low enough that dim text stays at 4.5 to 1 or more. */
export const SCANLINE_ALPHA = 0.25;

const HEX_DIGITS = '0123456789abcdef';
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const SRGB_STEPS = 255;

function hexByte(high: string, low: string): number {
  return HEX_DIGITS.indexOf(high) * 16 + HEX_DIGITS.indexOf(low);
}

function linear(channel: number): number {
  const c = channel / SRGB_STEPS;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  if (!HEX_COLOUR.test(hex)) throw new Error('THEME COLOUR NOT #RRGGBB');
  const h = hex.toLowerCase();
  const r = hexByte(h.charAt(1), h.charAt(2));
  const g = hexByte(h.charAt(3), h.charAt(4));
  const b = hexByte(h.charAt(5), h.charAt(6));
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours, from 1 to 21. Symmetric. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
