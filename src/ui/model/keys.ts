// Key handling (terminal-ui design, section C). Pure: no DOM, no state.
//
// Rules, first match wins:
//   1  F1 to F10 (any modifiers)        -> PF n, preventDefault
//   2  Alt + bound `code`, no ctrl/meta -> PF n, preventDefault (matched on `code`, never on `key`)
//   3  any ctrl, meta or alt left       -> no action, browser keeps the key
//   4  Tab  5 Enter  6 Backspace        -> TAB, ENTER, BACKSPACE
//   7  printable ASCII                  -> CHAR
//   8  anything else                    -> no action
// F11 and F12 match no rule: the browser keeps full screen and developer tools.
import type { PfNumber, UserAction } from './types';

export interface KeyEventLike {
  readonly key: string;
  readonly code: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface KeyResult {
  readonly action: UserAction | null;
  readonly preventDefault: boolean;
}

/** Exactly F1 to F10. Looked up with `Object.hasOwn`, never by parsing the key name. */
const F_KEYS: Readonly<Record<string, PfNumber>> = Object.freeze({
  F1: 1,
  F2: 2,
  F3: 3,
  F4: 4,
  F5: 5,
  F6: 6,
  F7: 7,
  F8: 8,
  F9: 9,
  F10: 10,
});

/** Alt bindings by physical key. PF11 and PF12 are reachable only here. */
export const ALT_CODES: Readonly<Record<string, PfNumber>> = Object.freeze({
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  Digit0: 10,
  Minus: 11,
  Equal: 12,
});

const NO_ACTION: KeyResult = Object.freeze({ action: null, preventDefault: false });

/** The action for PF n. Used by `handleKey` and by the PF_Bar buttons. */
export function pfAction(pf: PfNumber): UserAction {
  return { type: 'PF', pf };
}

function handled(action: UserAction): KeyResult {
  return { action, preventDefault: true };
}

/** True for a code point 0x20 to 0x7E in a one-character string. */
function isPrintableAscii(key: string): boolean {
  if (key.length !== 1) return false;
  const point = key.charCodeAt(0);
  return point >= 0x20 && point <= 0x7e;
}

export function handleKey(e: KeyEventLike): KeyResult {
  if (Object.hasOwn(F_KEYS, e.key)) {
    return handled(pfAction(F_KEYS[e.key] as PfNumber));
  }
  if (e.altKey && !e.ctrlKey && !e.metaKey && Object.hasOwn(ALT_CODES, e.code)) {
    return handled(pfAction(ALT_CODES[e.code] as PfNumber));
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return NO_ACTION;
  if (e.key === 'Tab') return handled({ type: 'TAB', back: e.shiftKey });
  if (e.key === 'Enter') return handled({ type: 'ENTER' });
  if (e.key === 'Backspace') return handled({ type: 'BACKSPACE' });
  if (isPrintableAscii(e.key)) return handled({ type: 'CHAR', ch: e.key });
  return NO_ACTION;
}
