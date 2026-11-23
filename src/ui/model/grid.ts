// Rendering of the 80x24 grid (terminal-ui design, section A, "Render"). Pure and total.
// Rows 1 to 22 are the body, row 23 is the PF_Bar, row 24 is the status line.
import { layoutOf } from './screens/index';
import type { Field, TerminalState } from './types';

export const ROWS = 24;
export const COLS = 80;
export const BODY_ROWS = 22;
export const PF_ROW = 23;
export const STATUS_ROW = 24;

const TAMPERED_LABEL = 'TAMPERED';
const FILL = '_';

type InputField = Extract<Field, { kind: 'input' }>;

/** Every character outside 0x20..0x7E becomes `?`, then the text is cut and padded to `width`. */
function fit(text: string, width: number): string {
  const printable = Array.from(text, (c) => (c >= ' ' && c <= '~' ? c : '?')).join('');
  return printable.slice(0, width).padEnd(width);
}

/** Paints `text` into the row buffers at 1-based (row, col). Cells outside the body are skipped. */
function paint(body: string[][], row: number, col: number, text: string): void {
  const line = body[row - 1];
  if (line === undefined) return;
  const cells = Array.from(text, (c) => (c >= ' ' && c <= '~' ? c : '?'));
  cells.forEach((c, i) => {
    const x = col - 1 + i;
    if (x >= 0 && x < COLS) line[x] = c;
  });
}

/** The input fields of the current layout in Tab order: by row, then column. */
export function inputFields(state: TerminalState): readonly InputField[] {
  return layoutOf(state)
    .fields.filter((f): f is InputField => f.kind === 'input')
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

export function renderStatusRow(state: TerminalState): string {
  // Tampered means the Working_Batch differs from the loaded batch, which is `edits.size > 0`.
  const tampered = state.edits.size > 0 && (state.screen === 'CTM200' || state.screen === 'CTM300');
  if (tampered) return `${fit(state.status, COLS - TAMPERED_LABEL.length - 1)} ${TAMPERED_LABEL}`;
  return fit(state.status, COLS);
}

export function renderGrid(state: TerminalState): string[] {
  const layout = layoutOf(state);
  const body: string[][] = Array.from({ length: BODY_ROWS }, () => Array.from({ length: COLS }, () => ' '));
  for (const f of layout.fields) {
    if (f.kind === 'text') {
      paint(body, f.row, f.col, f.text);
    } else {
      const value = (state.fields[f.id] ?? '').slice(0, f.length);
      paint(body, f.row, f.col, value + FILL.repeat(f.length - value.length));
    }
  }
  const bar = fit(layout.pf.map((e) => `PF${e.pf} ${e.label}`).join('  '), COLS);
  return [...body.map((cells) => cells.join('')), bar, renderStatusRow(state)];
}

/** Row and column (1-based) of the cursor, or null. For the view only. */
export function cursorCell(state: TerminalState): { readonly row: number; readonly col: number } | null {
  if (state.cursor === null) return null;
  const { fieldId, offset } = state.cursor;
  const field = inputFields(state).find((f) => f.id === fieldId);
  if (field === undefined) return null;
  return { row: field.row, col: field.col + Math.min(offset, field.length - 1) };
}
