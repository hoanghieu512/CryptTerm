import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIMIT_CENTS } from '../../src/ledger/invariants';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { AMOUNT_INPUT_MESSAGES, parseAmountInput } from '../../src/ui/model/amount-input';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { layoutOf } from '../../src/ui/model/screens/index';
import type { PfNumber, TerminalState, UserAction } from '../../src/ui/model/types';
import { update } from '../../src/ui/model/update';
import { runProperty } from '../support/pbt';
import { withLimitText } from '../support/prove-state';
import {
  ENTER,
  PF_NUMBERS,
  TINY_BATCH,
  applyAll,
  pf,
  printableCharArb,
  stateOn,
  unprintableCharArb,
  userActionArb,
} from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';

// Group 1 tests of the verifier spec for the CTM900 screen itself: inactive PF keys, PF3, and the
// limit field. All of it runs on the pure model. Data is synthetic.

/** A CTM900 state with 0 to 12 random user actions applied. It always stays on CTM900. */
const verifyStateArb: fc.Arbitrary<TerminalState> = fc
  .array(userActionArb, { maxLength: 12 })
  .map((actions) => applyAll(stateOn('CTM900', TINY_BATCH), actions));

const INACTIVE_PF_NUMBERS: readonly PfNumber[] = PF_NUMBERS.filter((n) => n !== 3);

describe('verify_pf_inactive', () => {
  // Feature: verifier, Property 3: Inactive PF keys
  // **Validates: Requirements 1.5**
  it('verify_pf_inactive: every PF key except PF3 gives PF KEY NOT ACTIVE and no effect', () => {
    runProperty(
      'verify_pf_inactive',
      { seed: 20264903, numRuns: 200 },
      fc.property(verifyStateArb, fc.constantFrom(...INACTIVE_PF_NUMBERS), (state, n) => {
        expect(state.screen).toBe('CTM900');
        const result = update(state, { type: 'PF', pf: n });
        expect(result.state.status).toBe(MESSAGES.PF_INACTIVE);
        expect(result.state.screen).toBe('CTM900');
        expect(result.effects).toEqual([]);
        expect(layoutOf(state).pf.map((e) => e.pf)).toEqual([3]);
      }),
    );
  });
});

describe('verify_pf3_navigates', () => {
  /** A recording stand-in for `history` and `location`: any property read or call is counted. */
  function recordingGlobal(touches: string[], name: string): object {
    return new Proxy(
      {},
      {
        get(_target, key) {
          touches.push(`${name}.${String(key)}`);
          return undefined;
        },
        set(_target, key) {
          touches.push(`${name}.${String(key)}=`);
          return true;
        },
      },
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verify_pf3_navigates: PF3 returns one NAVIGATE effect to / and changes nothing else', () => {
    const state = stateOn('CTM900', TINY_BATCH);
    const result = update(state, pf(3));
    expect(result.effects).toEqual([{ type: 'NAVIGATE', href: '/' }]);
    expect(result.state).toEqual(state);
  });

  it('verify_pf3_navigates: the host calls navigate with / once, and makes no history or location call', () => {
    const touches: string[] = [];
    vi.stubGlobal('history', recordingGlobal(touches, 'history'));
    vi.stubGlobal('location', recordingGlobal(touches, 'location'));
    const initial = stateOn('CTM900', TINY_BATCH);
    const h = makeHarness({ initial });
    h.terminal.dispatch(pf(3));
    expect(h.navigations).toEqual(['/']);
    expect(h.terminal.getState()).toEqual(initial);
    // The harness has no other dep that navigates, so nothing may have touched the globals.
    expect(touches).toEqual([]);
  });

  it('verify_pf3_navigates: a navigate dep that throws is ignored and the state stays', () => {
    const initial = stateOn('CTM900', TINY_BATCH);
    const h = makeHarness({
      initial,
      deps: {
        navigate: () => {
          throw new Error('NAVIGATE FAILED');
        },
      },
    });
    h.terminal.dispatch(pf(3));
    expect(h.terminal.getState()).toEqual(initial);
  });
});

// The limit field: a CHAR, BACKSPACE or TAB action in any order.
const keySequenceArb: fc.Arbitrary<UserAction[]> = fc.array(
  fc.oneof(
    { weight: 5, arbitrary: printableCharArb.map((ch): UserAction => ({ type: 'CHAR', ch })) },
    { weight: 1, arbitrary: unprintableCharArb.map((ch): UserAction => ({ type: 'CHAR', ch })) },
    { weight: 3, arbitrary: fc.constant<UserAction>({ type: 'BACKSPACE' }) },
    { weight: 2, arbitrary: fc.boolean().map((back): UserAction => ({ type: 'TAB', back })) },
  ),
  { maxLength: 30 },
);

// Digits that are planted into rejected texts. No message and no row outside the field may hold them.
const SENTINEL_DIGITS = '918273645';

/** The limit field is on row 6, so it is index 5 of the rendered rows. */
const LIMIT_ROW_INDEX = 5;

const digitsArb = (min: number, max: number): fc.Arbitrary<string> =>
  fc.string({ unit: fc.constantFrom(...'0123456789'.split('')), minLength: min, maxLength: max });

/** 1 to 30 digits with a non-zero first digit. */
const nonZeroLeadArb = (min: number, max: number): fc.Arbitrary<string> =>
  fc.tuple(fc.constantFrom(...'123456789'.split('')), digitsArb(min - 1, max - 1)).map(([lead, rest]) => `${lead}${rest}`);

const NEAR_2_POW_53: readonly bigint[] = [-4n, -3n, -2n, -1n, 0n, 1n, 2n, 3n, 4n].map((d) => 2n ** 53n + d);

// Texts that parseAmountInput must refuse. Each class of Requirement 2.4 is here.
const invalidLimitTextArb: fc.Arbitrary<string> = fc
  .oneof(
    fc.constant(''),
    fc.tuple(fc.constantFrom('-', '+'), nonZeroLeadArb(1, 12)).map(([sign, d]) => `${sign}${d}`),
    fc.tuple(nonZeroLeadArb(1, 8), digitsArb(1, 4)).map(([a, b]) => `${a}.${b}`),
    fc.tuple(nonZeroLeadArb(1, 6), fc.constantFrom('e', 'E'), digitsArb(1, 3)).map(([a, e, b]) => `${a}${e}${b}`),
    fc.tuple(fc.constantFrom(' ', '\t', '\n'), nonZeroLeadArb(1, 8)).map(([w, d]) => `${w}${d}`),
    nonZeroLeadArb(1, 8).map((d) => `${d} `),
    digitsArb(1, 12).map((d) => `0${d}`),
    nonZeroLeadArb(14, 30),
    fc.bigInt({ min: AMOUNT_BOUND_CENTS, max: 10n ** 13n - 1n }).map((v) => v.toString()),
    fc.constantFrom(AMOUNT_BOUND_CENTS, ...NEAR_2_POW_53).map((v) => v.toString()),
    fc.string({ maxLength: 16 }),
  )
  .filter((text) => !parseAmountInput(text).ok);

function expectedRefusal(text: string): string {
  const parsed = parseAmountInput(text);
  if (parsed.ok) throw new Error('FIXTURE: TEXT IS ACCEPTED');
  return AMOUNT_INPUT_MESSAGES[parsed.error];
}

describe('verify_limit_field_rules', () => {
  it('verify_limit_field_rules: the field holds the decimal text of LIMIT_CENTS, with the cursor in it, on row 6', () => {
    const state = stateOn('CTM900', TINY_BATCH);
    expect(state.screen).toBe('CTM900');
    expect(state.fields.limit).toBe(LIMIT_CENTS.toString());
    expect(state.cursor?.fieldId).toBe('limit');
    const inputs = layoutOf(state).fields.filter((f) => f.kind === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ kind: 'input', id: 'limit', row: 6, col: 22, length: 13, protected: false });
    const row = renderGrid(state)[LIMIT_ROW_INDEX] ?? '';
    expect(row.startsWith(`POLICY LIMIT (CENTS) ${LIMIT_CENTS.toString()}______`)).toBe(true);
  });

  // Feature: verifier, Property 4: Limit field editing matches CTM300
  // **Validates: Requirements 2.2**
  it('verify_limit_field_rules: any CHAR, BACKSPACE and TAB sequence gives the same limit text and cursor as CTM300', () => {
    runProperty('verify_limit_field_rules key parity', { seed: 20264904, numRuns: 200 }, fc.property(keySequenceArb, (actions) => {
      let verify = stateOn('CTM900', TINY_BATCH);
      let prove = stateOn('CTM300', TINY_BATCH);
      expect(verify.fields.limit).toBe(prove.fields.limit);
      for (const action of actions) {
        verify = update(verify, action).state;
        prove = update(prove, action).state;
        expect(verify.fields.limit).toBe(prove.fields.limit);
        expect(verify.cursor).toEqual(prove.cursor);
      }
    }));
  });

  // Feature: verifier, Property 5: Limit acceptance and refusal (the refusal half)
  // **Validates: Requirements 2.4, 2.5**
  it('verify_limit_field_rules: Enter on a refused limit text writes the matching message, keeps the cursor, and has no effect', () => {
    runProperty('verify_limit_field_rules refusal', { seed: 20264905, numRuns: 200 }, fc.property(invalidLimitTextArb, (text) => {
      const before = withLimitText(stateOn('CTM900', TINY_BATCH), text);
      const result = update(before, ENTER);
      expect(result.effects).toEqual([]);
      expect(result.state.status).toBe(expectedRefusal(text));
      expect(result.state.screen).toBe('CTM900');
      expect(result.state.cursor?.fieldId).toBe('limit');
      expect(result.state.fields.limit).toBe(text);
      // No run starts and nothing about the bundle changes.
      expect(result.state.verify).toEqual(before.verify);
      expect(result.state.verify.run).toBeNull();
      expect(result.state.nextRunId).toBe(before.nextRunId);
    }));
  });

  it('verify_limit_field_rules: the examples at 2^40 and within 4 of 2^53 are refused as out of range', () => {
    const texts = [AMOUNT_BOUND_CENTS.toString(), ...NEAR_2_POW_53.map((v) => v.toString())];
    expect(texts).toContain('1099511627776');
    for (const text of texts) {
      const result = update(withLimitText(stateOn('CTM900', TINY_BATCH), text), ENTER);
      expect(result.effects).toEqual([]);
      expect(result.state.status).toBe(AMOUNT_INPUT_MESSAGES.OUT_OF_RANGE);
      expect(result.state.cursor?.fieldId).toBe('limit');
    }
  });

  it('verify_limit_field_rules: the refusal message holds no part of the typed text, and no row outside the field does', () => {
    // The field draws its first 13 characters. A text of 13 filler characters and then the
    // sentinel hides the sentinel from the field too, so it can be in no row at all.
    const hiddenInField = `${'x'.repeat(13)}${SENTINEL_DIGITS}`;
    const planted = [
      `x${SENTINEL_DIGITS}`,
      `-${SENTINEL_DIGITS}`,
      `${SENTINEL_DIGITS}.50`,
      `${SENTINEL_DIGITS}e3`,
      ` ${SENTINEL_DIGITS}`,
      `0${SENTINEL_DIGITS}`,
      `${SENTINEL_DIGITS}${SENTINEL_DIGITS}`,
      hiddenInField,
    ];
    for (const text of planted) {
      const result = update(withLimitText(stateOn('CTM900', TINY_BATCH), text), ENTER);
      expect(result.state.status).toBe(expectedRefusal(text));
      const rows = renderGrid(result.state);
      rows.forEach((row, i) => {
        if (i !== LIMIT_ROW_INDEX) expect(row, `row ${i + 1}`).not.toContain(SENTINEL_DIGITS);
      });
    }
    const hidden = update(withLimitText(stateOn('CTM900', TINY_BATCH), hiddenInField), ENTER);
    for (const row of renderGrid(hidden.state)) expect(row).not.toContain(SENTINEL_DIGITS);
  });

  it('verify_limit_field_rules: the refusal does not depend on a bundle being on screen', () => {
    const withBundle = update(stateOn('CTM900', TINY_BATCH), { type: 'PASTE_TEXT', text: 'abc' }).state;
    const result = update(withLimitText(withBundle, '12.5'), ENTER);
    expect(result.effects).toEqual([]);
    expect(result.state.status).toBe(AMOUNT_INPUT_MESSAGES.NOT_DIGITS);
    expect(result.state.verify.bundleText).toBe('abc');
  });
});
