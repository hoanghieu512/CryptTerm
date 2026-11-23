// fast-check arbitraries and drivers for the terminal-ui model tests
// (terminal-ui spec, design.md "Testing Strategy").
//
// The terminal state is plain data, so tests drive `update` directly. Nothing here touches the
// DOM, the network or a prover. Everything is synthetic.
//
//   keyEventArb      a key event over F-keys, Alt codes, Option characters and modifiers
//   userActionArb    PF, ENTER, TAB, BACKSPACE and CHAR actions
//   sampleStateArb   a state that went CTM000 -> CTM100 -> SAMPLE_LOADED -> CTM200, then random actions
//   reachableStateArb  states on every screen, with and without a loaded sample
//   fakeFetch        a fetch that serves the committed public/samples files and records URLs
//   editSlot         tamper edit through the model (page, PF12, typed text, Enter)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import type { Batch } from '../../src/ledger/batch';
import type { SignedDigest } from '../../src/ledger/digest';
import { parseBatch } from '../../src/ledger/parse';
import type { KeyEventLike } from '../../src/ui/model/keys';
import type { FetchLike } from '../../src/ui/sample-loader';
import { initialState, update } from '../../src/ui/model/update';
import type { Action, LoadedSample, PfNumber, ScreenId, TerminalState, UserAction } from '../../src/ui/model/types';
import { SENTINEL, batchArb } from './ledger-arbitraries';
import { shapedDigest } from './prove-fixtures';

/** The four screens in flow order. Tests also assert that `SCREENS` has exactly these keys. */
export const SCREEN_IDS: readonly ScreenId[] = ['CTM000', 'CTM100', 'CTM200', 'CTM300'];

export const PF_NUMBERS: readonly PfNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The Alt binding table, written as literals here (not read from `keys.ts`). */
export const ALT_CODE_TABLE: Readonly<Record<string, PfNumber>> = {
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
};

/** What Option+<digit row key> types on a US macOS layout. Not the digit itself. */
export const MAC_OPTION_KEYS: Readonly<Record<string, string>> = {
  Digit1: '¡',
  Digit2: '™',
  Digit3: '£',
  Digit4: '¢',
  Digit5: '∞',
  Digit6: '§',
  Digit7: '¶',
  Digit8: '•',
  Digit9: 'ª',
  Digit0: 'º',
  Minus: '–',
  Equal: '≠',
};

export function isAltCode(code: string): boolean {
  return Object.hasOwn(ALT_CODE_TABLE, code);
}

// ---------------------------------------------------------------------------------------------
// Key events
// ---------------------------------------------------------------------------------------------

export function keyEvent(key: string, code: string, mods: Partial<Pick<KeyEventLike, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {}): KeyEventLike {
  return { key, code, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods };
}

export const F_KEYS_1_TO_10: readonly string[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'];

const MODIFIER_FLAGS = {
  altKey: fc.boolean(),
  ctrlKey: fc.boolean(),
  metaKey: fc.boolean(),
  shiftKey: fc.boolean(),
} as const;

export const modifiersArb = fc.record(MODIFIER_FLAGS);

const CODE_POOL: readonly string[] = [
  ...Object.keys(ALT_CODE_TABLE),
  'F1', 'F5', 'F11', 'F12', 'KeyA', 'KeyR', 'KeyI', 'Tab', 'Enter', 'Backspace', 'Space', 'Slash', 'Quote', 'Escape', 'ArrowUp', '',
];

/** Any `code`: the twelve Alt codes, F-key codes, letters and a few others. */
export const codeArb: fc.Arbitrary<string> = fc.constantFrom(...CODE_POOL);

/** Any `key` text: control keys, printable ASCII, macOS Option characters and F-keys. */
export const anyKeyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('Tab', 'Enter', 'Backspace', 'Escape', 'ArrowUp', 'Dead', 'Shift', 'Alt', 'Meta', 'Control', 'F11', 'F12', ...F_KEYS_1_TO_10),
  fc.constantFrom(...Object.values(MAC_OPTION_KEYS)),
  fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)),
  fc.constantFrom('é', '€', '\u0000', '\u007f', '\n', ''),
);

export const keyEventArb: fc.Arbitrary<KeyEventLike> = fc
  .tuple(anyKeyArb, codeArb, modifiersArb)
  .map(([key, code, mods]) => keyEvent(key, code, mods));

// ---------------------------------------------------------------------------------------------
// User actions
// ---------------------------------------------------------------------------------------------

export const pfNumberArb: fc.Arbitrary<PfNumber> = fc.constantFrom(...PF_NUMBERS);

export const printableCharArb: fc.Arbitrary<string> = fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c));

/** Characters a CHAR action must ignore: control, DEL, non-ASCII, empty. */
export const unprintableCharArb: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: 0x00, max: 0x1f }).map((c) => String.fromCharCode(c)),
  fc.constantFrom('\u007f', '\u0080', 'é', '€', '¡', '٣', '\u{1F600}', ''),
);

export const userActionArb: fc.Arbitrary<UserAction> = fc.oneof(
  { weight: 3, arbitrary: pfNumberArb.map((pf): UserAction => ({ type: 'PF', pf })) },
  { weight: 3, arbitrary: fc.constant<UserAction>({ type: 'ENTER' }) },
  { weight: 2, arbitrary: fc.boolean().map((back): UserAction => ({ type: 'TAB', back })) },
  { weight: 1, arbitrary: fc.constant<UserAction>({ type: 'BACKSPACE' }) },
  { weight: 4, arbitrary: printableCharArb.map((ch): UserAction => ({ type: 'CHAR', ch })) },
  { weight: 1, arbitrary: unprintableCharArb.map((ch): UserAction => ({ type: 'CHAR', ch })) },
);

// ---------------------------------------------------------------------------------------------
// Driving the model
// ---------------------------------------------------------------------------------------------

export function step(state: TerminalState, action: Action): TerminalState {
  return update(state, action).state;
}

export function applyAll(state: TerminalState, actions: readonly Action[]): TerminalState {
  return actions.reduce<TerminalState>(step, state);
}

/** One CHAR action per character of `text`. */
export function typeText(state: TerminalState, text: string): TerminalState {
  return applyAll(state, Array.from(text, (ch): UserAction => ({ type: 'CHAR', ch })));
}

export const ENTER: UserAction = { type: 'ENTER' };

export function pf(n: PfNumber): UserAction {
  return { type: 'PF', pf: n };
}

/** A one-posting batch (debit 1.00 against nothing: it need not balance here). Synthetic ids. */
export const TINY_BATCH: Batch = {
  batchId: 'CTB-20261201-001',
  postings: [{ recordId: 1n, account: 123456789012n, side: 0n, amountCents: 100n, reviewFlag: 0n, salt: 7n }],
};

/** A digest of the right shape for `batch`. It is not a real signature and is never verified here. */
export function digestFor(batch: Batch): SignedDigest {
  return Object.freeze(shapedDigest({ batchId: batch.batchId, recordCount: batch.postings.length }));
}

/** The result of a successful sample load, as the host would build it. */
export function loadedSampleFor(batch: Batch, signatureValid = true): LoadedSample {
  return { name: 'clean', batch, digest: digestFor(batch), signatureValid };
}

/** CTM000 after Enter: CTM100. */
export function onSelectScreen(): TerminalState {
  return step(initialState(), ENTER);
}

/**
 * CTM000 -> CTM100 -> select `1` -> Enter -> `SAMPLE_LOADED` for the pending load id.
 * The result is on CTM200 with the sample loaded.
 */
export function loadedState(batch: Batch, signatureValid = true): TerminalState {
  const loading = step(typeText(onSelectScreen(), '1'), ENTER);
  const loadId = loading.pendingLoad;
  if (loadId === null) throw new Error('FIXTURE: NO PENDING LOAD AFTER SELECT AND ENTER');
  return step(loading, { type: 'SAMPLE_LOADED', loadId, sample: loadedSampleFor(batch, signatureValid) });
}

/** A state on `screen`, reached by the real flow. CTM300 is entered from CTM200 with Enter. */
export function stateOn(screen: ScreenId, batch: Batch): TerminalState {
  switch (screen) {
    case 'CTM000':
      return initialState();
    case 'CTM100':
      return onSelectScreen();
    case 'CTM200':
      return loadedState(batch);
    case 'CTM300':
      return step(loadedState(batch), ENTER);
  }
}

/** A loaded state followed by 0 to 12 random user actions. */
export function sampleStateArb(batch: Batch): fc.Arbitrary<TerminalState> {
  return fc.array(userActionArb, { maxLength: 12 }).map((actions) => applyAll(loadedState(batch), actions));
}

/** A state on one of the four screens, with 0 to 12 random user actions applied on top. */
export const reachableStateArb: fc.Arbitrary<TerminalState> = fc
  .tuple(fc.constantFrom(...SCREEN_IDS), batchArb, fc.array(userActionArb, { maxLength: 12 }))
  .map(([screen, batch, actions]) => applyAll(stateOn(screen, batch), actions));

/** A step in a mixed sequence: a user action, or the result of the pending sample load. */
export type FlowStep = { readonly kind: 'user'; readonly action: UserAction } | { readonly kind: 'load' };

export const flowStepArb: fc.Arbitrary<FlowStep> = fc.oneof(
  { weight: 4, arbitrary: fc.constant<FlowStep>({ kind: 'user', action: ENTER }) },
  { weight: 2, arbitrary: fc.constant<FlowStep>({ kind: 'user', action: pf(3) }) },
  { weight: 3, arbitrary: fc.constant<FlowStep>({ kind: 'user', action: { type: 'CHAR', ch: '1' } }) },
  { weight: 3, arbitrary: userActionArb.map((action): FlowStep => ({ kind: 'user', action })) },
  { weight: 4, arbitrary: fc.constant<FlowStep>({ kind: 'load' }) },
);

/** The action a `load` step stands for: the result for the pending load id, or a stale one. */
export function loadAction(state: TerminalState, batch: Batch): Action {
  const loadId = state.pendingLoad ?? state.nextLoadId + 1000;
  return { type: 'SAMPLE_LOADED', loadId, sample: loadedSampleFor(batch) };
}
// ---------------------------------------------------------------------------------------------
// Sample loading: a fake fetch over the committed signed samples (group 2)
// ---------------------------------------------------------------------------------------------
const SAMPLES_DIR = fileURLToPath(new URL('../../public/samples/', import.meta.url));
const SERVED_NAME = /^[a-z-]+\.(dat|digest\.json)$/;
/** What a test can plant for a URL: file text, a not-ok response, or a failing request. */
export type FakeServed = string | { readonly notOk: true } | { readonly throws: true };
export interface FakeFetch {
  readonly fetch: FetchLike;
  /** Every URL requested, in order. */
  readonly urls: string[];
}
/**
 * Serves `/samples/<name>.dat` and `/samples/<name>.digest.json` from the committed files.
 * `overrides` replaces one URL. A planted failure carries the sentinel in its body or message, so
 * a test can assert that no message of the model holds it.
 */
export function fakeFetch(overrides: Readonly<Record<string, FakeServed>> = {}): FakeFetch {
  const urls: string[] = [];
  const notOk = { ok: false, text: async () => `BODY ${SENTINEL}` };
  const fetchFn: FetchLike = async (url) => {
    urls.push(url);
    if (Object.hasOwn(overrides, url)) {
      const planted = overrides[url];
      if (typeof planted === 'string') return { ok: true, text: async () => planted };
      if (planted !== undefined && 'throws' in planted) throw new Error(`NETWORK ${SENTINEL}`);
      return notOk;
    }
    const prefix = '/samples/';
    const file = url.startsWith(prefix) ? url.slice(prefix.length) : '';
    if (!SERVED_NAME.test(file)) return notOk;
    return { ok: true, text: async () => readFileSync(`${SAMPLES_DIR}${file}`, 'utf8') };
  };
  return { fetch: fetchFn, urls };
}
/** The committed text and digest of a sample, read straight from disk. */
export function committedSample(name: string): { readonly text: string; readonly batch: Batch; readonly digest: SignedDigest } {
  const text = readFileSync(`${SAMPLES_DIR}${name}.dat`, 'utf8');
  const digest = JSON.parse(readFileSync(`${SAMPLES_DIR}${name}.digest.json`, 'utf8')) as SignedDigest;
  return { text, batch: parseBatch(text), digest };
}
// ---------------------------------------------------------------------------------------------
// Tamper drivers (group 2). They go through the model, one real action at a time.
// ---------------------------------------------------------------------------------------------
/** The CTM200 page size under test, written as a literal on purpose. */
export const PAGE_SIZE_UNDER_TEST = 12;
/** PF7 or PF8 until the CTM200 page index is `page`. */
export function pressUntilPage(state: TerminalState, page: number): TerminalState {
  let s = state;
  for (let i = 0; i < 20 && s.page !== page; i += 1) s = step(s, pf(s.page < page ? 8 : 7));
  return s;
}
/** In tamper mode: put the typed texts into the `amt:<slot>` fields, then press Enter. */
export function submitTyped(state: TerminalState, typed: Readonly<Record<number, string>>): TerminalState {
  const fields: Record<string, string | undefined> = { ...state.fields };
  for (const [slot, text] of Object.entries(typed)) fields[`amt:${slot}`] = text;
  return step({ ...state, fields }, ENTER);
}
/** Edit one slot to `cents`: go to its page, switch tamper mode on if needed, type, Enter. */
export function editSlot(state: TerminalState, slot: number, cents: bigint): TerminalState {
  let s = pressUntilPage(state, Math.floor(slot / PAGE_SIZE_UNDER_TEST));
  if (!s.tamper) s = step(s, pf(12));
  return submitTyped(s, { [slot]: cents.toString() });
}
