import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { handleKey, pfAction } from '../../src/ui/model/keys';
import { MESSAGES } from '../../src/ui/model/messages';
import { initialState, update } from '../../src/ui/model/update';
import type { PfNumber } from '../../src/ui/model/types';
import { runProperty } from '../support/pbt';
import {
  ALT_CODE_TABLE,
  ENTER,
  F_KEYS_1_TO_10,
  MAC_OPTION_KEYS,
  PF_NUMBERS,
  SCREEN_IDS,
  codeArb,
  isAltCode,
  keyEvent,
  keyEventArb,
  modifiersArb,
  pfNumberArb,
  reachableStateArb,
  stateOn,
  step,
} from '../support/terminal-arbitraries';
import { batchArb } from '../support/ledger-arbitraries';

const NO_ACTION = { action: null, preventDefault: false } as const;

// Feature: terminal-ui, Property 5: F1 to F10 map to their PF keys, F11 and F12 are left to the browser
// **Validates: Requirements 2.1, 2.3, 2.4**
//
// Seed 20264005, 200 runs for each test of this section. F1 to F10, with any modifiers and any
// `code`, give `PF n` and `preventDefault: true`. F11 and F12 give no action and no
// `preventDefault`, except through the Alt binding.
describe('pf5_does_not_reload', () => {
  it('pf5_does_not_reload: F1 to F10 give PF n and preventDefault, with any modifiers and code', () => {
    runProperty(
      'pf5_does_not_reload',
      { seed: 20264005, numRuns: 200 },
      fc.property(fc.integer({ min: 0, max: 9 }), modifiersArb, codeArb, reachableStateArb, (index, mods, code, state) => {
        const n = (index + 1) as PfNumber;
        const result = handleKey(keyEvent(F_KEYS_1_TO_10[index] ?? '', code, mods));
        expect(result).toEqual({ action: { type: 'PF', pf: n }, preventDefault: true });
        // The key and the PF_Bar button run the same action in every reachable state.
        expect(update(state, result.action ?? ENTER)).toEqual(update(state, pfAction(n)));
      }),
    );
  });

  it('pf5_does_not_reload: F5 on every screen reports preventDefault, handled or not', () => {
    runProperty('pf5_does_not_reload per screen', { seed: 20264005, numRuns: 200 }, fc.property(batchArb, (batch) => {
      for (const screen of SCREEN_IDS) {
        const state = stateOn(screen, batch);
        const result = handleKey(keyEvent('F5', 'F5'));
        expect(result.preventDefault).toBe(true);
        expect(result.action).toEqual({ type: 'PF', pf: 5 });
        const next = update(state, result.action ?? ENTER);
        // An inactive PF5 changes only the status line. It never changes the screen.
        expect(next.state.screen).toBe(state.screen);
      }
    }));
  });

  it('pf5_does_not_reload: F5 on CTM000 is inactive, shows the fixed text and still prevents the reload', () => {
    const result = handleKey(keyEvent('F5', 'F5'));
    expect(result).toEqual({ action: { type: 'PF', pf: 5 }, preventDefault: true });
    const next = update(initialState(), pfAction(5));
    expect(next.state.screen).toBe('CTM000');
    expect(next.state.status).toBe(MESSAGES.PF_INACTIVE);
    expect(next.effects).toEqual([]);
  });

  it('pf5_does_not_reload: Ctrl+F5 and Shift+F5 do not reload either', () => {
    expect(handleKey(keyEvent('F5', 'F5', { ctrlKey: true }))).toEqual({ action: { type: 'PF', pf: 5 }, preventDefault: true });
    expect(handleKey(keyEvent('F5', 'F5', { shiftKey: true }))).toEqual({ action: { type: 'PF', pf: 5 }, preventDefault: true });
    expect(handleKey(keyEvent('F5', 'F5', { metaKey: true }))).toEqual({ action: { type: 'PF', pf: 5 }, preventDefault: true });
  });

  it('pf5_does_not_reload: a key named like an F key but not F1 to F10 is not mapped', () => {
    for (const key of ['f5', 'F05', 'F13', 'F0', 'F 5', 'F5 ', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const result = handleKey(keyEvent(key, ''));
      expect(result.action === null || result.action.type !== 'PF').toBe(true);
    }
  });
});

describe('f11_f12_not_handled', () => {
  /** True when the event matches the Alt binding, which this test excludes. */
  function isAltBinding(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; code: string }): boolean {
    return e.altKey && !e.ctrlKey && !e.metaKey && isAltCode(e.code);
  }

  it('f11_f12_not_handled: F11 and F12 give no action and no preventDefault, with any modifiers and code', () => {
    runProperty(
      'f11_f12_not_handled',
      { seed: 20264005, numRuns: 200 },
      fc.property(fc.constantFrom('F11', 'F12'), modifiersArb, codeArb, (key, mods, code) => {
        fc.pre(!isAltBinding({ ...mods, code }));
        expect(handleKey(keyEvent(key, code, mods))).toEqual(NO_ACTION);
      }),
    );
  });

  it.each([
    ['F11', 'F11', {}],
    ['F12', 'F12', {}],
    ['F11', 'F11', { shiftKey: true }],
    ['F12', 'F12', { shiftKey: true }],
    ['F11', 'F11', { altKey: true }],
    ['F12', 'F12', { altKey: true }],
    ['F11', 'F11', { ctrlKey: true }],
    ['F12', 'F12', { metaKey: true }],
    ['F12', 'F12', { altKey: true, metaKey: true }],
    ['F11', 'Digit1', { ctrlKey: true, altKey: true }],
  ] as const)('f11_f12_not_handled: %s with %j leaves the key to the browser', (key, code, mods) => {
    expect(handleKey(keyEvent(key, code, mods))).toEqual(NO_ACTION);
  });

  it('f11_f12_not_handled: PF11 and PF12 are reachable through Alt+Minus and Alt+Equal', () => {
    expect(handleKey(keyEvent('–', 'Minus', { altKey: true }))).toEqual({ action: { type: 'PF', pf: 11 }, preventDefault: true });
    expect(handleKey(keyEvent('≠', 'Equal', { altKey: true }))).toEqual({ action: { type: 'PF', pf: 12 }, preventDefault: true });
  });
});

// Feature: terminal-ui, Property 6: Alt bindings match on `code` and ignore `key`
// **Validates: Requirements 2.2**
//
// Seed 20264006, 200 runs. `key` is any string except F1 to F10 (those take rule 1). The Alt path
// gives `PF n` if and only if `altKey` is set, `ctrlKey` and `metaKey` are not, and `code` is one
// of the twelve bound codes. With `ctrlKey` or `metaKey` set, the result is no action and no
// `preventDefault`.
describe('alt_bindings_work', () => {
  const keyTextArb: fc.Arbitrary<string> = fc
    .oneof(fc.string({ maxLength: 4 }), fc.constantFrom(...Object.values(MAC_OPTION_KEYS)), fc.constantFrom('Tab', 'Enter', 'Backspace', 'F11', 'F12'))
    .filter((key) => !F_KEYS_1_TO_10.includes(key));

  it('alt_bindings_work: PF n if and only if altKey, no ctrl, no meta and a bound code', () => {
    runProperty(
      'alt_bindings_work',
      { seed: 20264006, numRuns: 200 },
      fc.property(keyTextArb, codeArb, modifiersArb, (key, code, mods) => {
        const result = handleKey(keyEvent(key, code, mods));
        const bound = mods.altKey && !mods.ctrlKey && !mods.metaKey && isAltCode(code);
        if (bound) {
          expect(result).toEqual({ action: { type: 'PF', pf: ALT_CODE_TABLE[code] }, preventDefault: true });
        } else {
          expect(result.action === null || result.action.type !== 'PF').toBe(true);
        }
      }),
    );
  });

  it('alt_bindings_work: ctrl or meta without an F1 to F10 key gives no action and no preventDefault', () => {
    runProperty(
      'alt_bindings_work ctrl meta',
      { seed: 20264006, numRuns: 200 },
      fc.property(keyTextArb, codeArb, modifiersArb, (key, code, mods) => {
        fc.pre(mods.ctrlKey || mods.metaKey);
        expect(handleKey(keyEvent(key, code, mods))).toEqual(NO_ACTION);
      }),
    );
  });

  it.each(Object.entries(ALT_CODE_TABLE))('alt_bindings_work: macOS example Alt+%s is PF%i', (code, n) => {
    const optionKey = MAC_OPTION_KEYS[code] ?? '';
    expect(optionKey).not.toBe('');
    expect(handleKey(keyEvent(optionKey, code, { altKey: true }))).toEqual({
      action: { type: 'PF', pf: n },
      preventDefault: true,
    });
  });

  it('alt_bindings_work: there are exactly 12 macOS examples', () => {
    expect(Object.keys(ALT_CODE_TABLE)).toHaveLength(12);
    expect(Object.keys(MAC_OPTION_KEYS)).toHaveLength(12);
  });

  it('alt_bindings_work: Cmd+R, Cmd+Option+I and Ctrl+C are never touched', () => {
    expect(handleKey(keyEvent('r', 'KeyR', { metaKey: true }))).toEqual(NO_ACTION);
    expect(handleKey(keyEvent('i', 'KeyI', { metaKey: true, altKey: true }))).toEqual(NO_ACTION);
    expect(handleKey(keyEvent('c', 'KeyC', { ctrlKey: true }))).toEqual(NO_ACTION);
    expect(handleKey(keyEvent('1', 'Digit1', { metaKey: true, altKey: true }))).toEqual(NO_ACTION);
    expect(handleKey(keyEvent('1', 'Digit1', { ctrlKey: true, altKey: true }))).toEqual(NO_ACTION);
  });

  it('alt_bindings_work: a lookalike code that is not an own key is not bound', () => {
    for (const code of ['__proto__', 'constructor', 'toString', 'digit1', 'Digit10', 'Numpad1']) {
      expect(handleKey(keyEvent('1', code, { altKey: true }))).toEqual(NO_ACTION);
    }
  });
});

// Feature: terminal-ui, Property 5 (button parity): a PF_Bar button and the matching key run the same action
// **Validates: Requirements 2.4**
describe('pf_bar_buttons_match_keys', () => {
  /** A key event that stands for PF n: F-key for 1 to 10, Alt binding for any n. */
  function eventFor(n: PfNumber, viaAlt: boolean): ReturnType<typeof keyEvent> {
    if (n <= 10 && !viaAlt) return keyEvent(`F${n}`, `F${n}`);
    const code = Object.entries(ALT_CODE_TABLE).find(([, pfNumber]) => pfNumber === n)?.[0] ?? '';
    return keyEvent(MAC_OPTION_KEYS[code] ?? '', code, { altKey: true });
  }

  it('pf_bar_buttons_match_keys: pfAction(n) is PF n', () => {
    for (const n of PF_NUMBERS) expect(pfAction(n)).toEqual({ type: 'PF', pf: n });
  });

  it('pf_bar_buttons_match_keys: the key and the button give the same update in every state', () => {
    runProperty(
      'pf_bar_buttons_match_keys',
      { seed: 20264005, numRuns: 200 },
      fc.property(pfNumberArb, fc.boolean(), reachableStateArb, (n, viaAlt, state) => {
        const keyResult = handleKey(eventFor(n, viaAlt));
        expect(keyResult.action).toEqual(pfAction(n));
        expect(keyResult.preventDefault).toBe(true);
        expect(update(state, keyResult.action ?? ENTER)).toEqual(update(state, pfAction(n)));
      }),
    );
  });

  it('pf_bar_buttons_match_keys: a key press leaves a state that the button reaches too', () => {
    const state = step(initialState(), ENTER);
    expect(step(state, pfAction(3))).toEqual(step(state, handleKey(keyEvent('F3', 'F3')).action ?? ENTER));
  });
});

// Other key rules (design section C, rules 4 to 8). Example tests.
describe('handleKey: editing keys', () => {
  it('maps Tab, Shift+Tab, Enter and Backspace and prevents their defaults', () => {
    expect(handleKey(keyEvent('Tab', 'Tab'))).toEqual({ action: { type: 'TAB', back: false }, preventDefault: true });
    expect(handleKey(keyEvent('Tab', 'Tab', { shiftKey: true }))).toEqual({ action: { type: 'TAB', back: true }, preventDefault: true });
    expect(handleKey(keyEvent('Enter', 'Enter'))).toEqual({ action: { type: 'ENTER' }, preventDefault: true });
    expect(handleKey(keyEvent('Backspace', 'Backspace'))).toEqual({ action: { type: 'BACKSPACE' }, preventDefault: true });
  });

  it('maps printable ASCII to CHAR and prevents the default (space, slash, quote)', () => {
    for (const ch of [' ', '/', "'", 'a', 'Z', '0', '~']) {
      expect(handleKey(keyEvent(ch, 'KeyA'))).toEqual({ action: { type: 'CHAR', ch }, preventDefault: true });
    }
  });

  it('ignores non-printable and non-ASCII keys without preventing the default', () => {
    for (const key of ['Escape', 'ArrowLeft', 'Shift', 'Dead', 'é', '€', '¡', '']) {
      expect(handleKey(keyEvent(key, ''))).toEqual(NO_ACTION);
    }
  });

  it('never throws and never returns an action with an unknown type', () => {
    runProperty('handleKey total', { seed: 20264005, numRuns: 200 }, fc.property(keyEventArb, (e) => {
      const result = handleKey(e);
      expect(typeof result.preventDefault).toBe('boolean');
      if (result.action !== null) {
        expect(['PF', 'ENTER', 'TAB', 'BACKSPACE', 'CHAR']).toContain(result.action.type);
      } else {
        expect(result.preventDefault).toBe(false);
      }
    }));
  });
});
