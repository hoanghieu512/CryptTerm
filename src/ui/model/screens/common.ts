// Small layout helpers shared by the four screens. Rows and columns are 1-based.
import type { Field, ScreenId } from '../types';

export const SCREEN_NAMES: Readonly<Record<ScreenId, string>> = Object.freeze({
  CTM000: 'LOGON',
  CTM100: 'BATCH SELECT',
  CTM200: 'BATCH VIEW',
  CTM300: 'PROVE',
  CTM900: 'VERIFY',
});

export const DEMO_LABEL = 'DEMO DATA';
export const DEMO_COL = 72;

export function textField(row: number, col: number, text: string): Field {
  return { kind: 'text', protected: true, row, col, text };
}

export function inputField(id: Extract<Field, { kind: 'input' }>['id'], row: number, col: number, length: number): Field {
  return { kind: 'input', protected: false, id, row, col, length };
}

/** Row 1: `CTMnnn  <NAME>` on the left, `DEMO DATA` at column 72. */
export function headerFields(screen: ScreenId): Field[] {
  return [textField(1, 1, `${screen}  ${SCREEN_NAMES[screen]}`), textField(1, DEMO_COL, DEMO_LABEL)];
}

/** A text field centred on the 80-column grid. */
export function centred(row: number, text: string): Field {
  return textField(row, Math.floor((80 - text.length) / 2) + 1, text);
}
