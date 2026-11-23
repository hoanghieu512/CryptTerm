import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { AMOUNT_INPUT_MESSAGES, parseAmountInput } from '../../src/ui/model/amount-input';
import type { AmountInputError } from '../../src/ui/model/amount-input';
import { renderGrid } from '../../src/ui/model/grid';
import { runProperty } from '../support/pbt';
import { ENTER, onSelectScreen, step, typeText } from '../support/terminal-arbitraries';

// This file holds the valid half (Property 13) and the invalid half (Property 14) of
// `tamper_input_validation`. The atomic half (Property 15) needs the CTM200 screen and is written
// in group 2.
//
// Planted digits that no message or rendered row may contain.
const SENTINEL_DIGITS = '918273645';

const ERROR_CLASSES: readonly AmountInputError[] = ['EMPTY', 'NOT_DIGITS', 'LEADING_ZERO', 'OUT_OF_RANGE'];

const TWO_POW_53 = 2n ** 53n;
/** The nine values within 4 of 2^53, as bigint arithmetic only. */
const NEAR_2_POW_53: readonly bigint[] = [-4n, -3n, -2n, -1n, 0n, 1n, 2n, 3n, 4n].map((d) => TWO_POW_53 + d);

function expectError(text: string, error: AmountInputError): void {
  const result = parseAmountInput(text);
  expect(result).toEqual({ ok: false, error });
}

// ---------------------------------------------------------------------------------------------
// Valid half
// ---------------------------------------------------------------------------------------------

// Feature: terminal-ui, Property 13: Valid digit text parses to the same bigint
// **Validates: Requirements 5.1, 5.3**
//
// Seed 20264013, 200 runs. Text of 1 to 13 digits with no leading zero (or exactly `0`) and a
// value below 2^40. The boundary values 0 and 2^40 - 1 are always in the mix.
const validTextArb: fc.Arbitrary<string> = fc
  .oneof(
    { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, 9n, 10n, 1_000_000n, AMOUNT_BOUND_CENTS - 2n, AMOUNT_BOUND_CENTS - 1n) },
    { weight: 8, arbitrary: fc.bigInt({ min: 0n, max: AMOUNT_BOUND_CENTS - 1n }) },
  )
  .map((value) => value.toString());

describe('tamper_input_validation: valid half', () => {
  it('tamper_input_validation: valid digit text returns the same bigint (P13)', () => {
    runProperty('tamper_input_validation valid', { seed: 20264013, numRuns: 200 }, fc.property(validTextArb, (text) => {
      const result = parseAmountInput(text);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe('bigint');
        expect(result.value).toBe(BigInt(text));
      }
    }));
  });

  it('tamper_input_validation: 0 and 2^40 - 1 are accepted', () => {
    expect(parseAmountInput('0')).toEqual({ ok: true, value: 0n });
    expect(parseAmountInput('1099511627775')).toEqual({ ok: true, value: 1099511627775n });
    expect(parseAmountInput('1')).toEqual({ ok: true, value: 1n });
  });
});

// ---------------------------------------------------------------------------------------------
// Invalid half
// ---------------------------------------------------------------------------------------------

// Feature: terminal-ui, Property 14: Invalid text is rejected with a fixed message that does not echo it
// **Validates: Requirements 5.2, 5.3, 5.5**
//
// Seed 20264014, 200 runs. One generator per error class, so the expected class is known:
//   EMPTY         the empty text
//   NOT_DIGITS    sign, decimal point, exponent, whitespace, letter, non-ASCII digit
//   LEADING_ZERO  `0` followed by 1 to 12 digits
//   OUT_OF_RANGE  14 or more digits, and 13 digits with a value of 2^40 or more, including 2^40
//                 itself and every value within 4 of 2^53
const digitsArb = (min: number, max: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: min, maxLength: max }).map((d) => d.join(''));

const nonZeroLeadDigitsArb = (min: number, max: number): fc.Arbitrary<string> =>
  fc.tuple(fc.constantFrom(...'123456789'.split('')), digitsArb(min - 1, max - 1)).map(([lead, rest]) => `${lead}${rest}`);

interface InvalidCase {
  readonly text: string;
  readonly error: AmountInputError;
}

const emptyCaseArb: fc.Arbitrary<InvalidCase> = fc.constant<InvalidCase>({ text: '', error: 'EMPTY' });

const notDigitsCaseArb: fc.Arbitrary<InvalidCase> = fc
  .tuple(
    fc.oneof(
      fc.tuple(fc.constantFrom('-', '+'), nonZeroLeadDigitsArb(1, 6)).map(([s, d]) => `${s}${d}`),
      fc.tuple(nonZeroLeadDigitsArb(1, 5), fc.constantFrom('.', ','), digitsArb(0, 3)).map(([a, p, b]) => `${a}${p}${b}`),
      fc.tuple(nonZeroLeadDigitsArb(1, 4), fc.constantFrom('e', 'E'), fc.constantFrom('', '+', '-'), digitsArb(1, 2)).map(([a, e, s, b]) => `${a}${e}${s}${b}`),
      fc.tuple(fc.constantFrom(' ', '\t', '\n', '\u00a0'), nonZeroLeadDigitsArb(1, 6)).map(([w, d]) => `${w}${d}`),
      fc.tuple(nonZeroLeadDigitsArb(1, 6), fc.constantFrom(' ', '\t', '\n', '\r')).map(([d, w]) => `${d}${w}`),
      fc.tuple(nonZeroLeadDigitsArb(1, 3), fc.constantFrom(' ', '_'), nonZeroLeadDigitsArb(1, 3)).map(([a, w, b]) => `${a}${w}${b}`),
      fc.tuple(nonZeroLeadDigitsArb(1, 6), fc.constantFrom('a', 'x', 'Z', '$', '#')).map(([d, c]) => `${d}${c}`),
      fc.constantFrom('abc', '0x10', '0b1', 'NaN', 'Infinity', '٣', '１２３', '12３', '\u0663\u0664'),
    ),
  )
  .map(([text]) => ({ text, error: 'NOT_DIGITS' as const }));

const leadingZeroCaseArb: fc.Arbitrary<InvalidCase> = digitsArb(1, 12).map((rest) => ({
  text: `0${rest}`,
  error: 'LEADING_ZERO' as const,
}));

const outOfRangeCaseArb: fc.Arbitrary<InvalidCase> = fc.oneof(
  // 14 to 30 digits.
  nonZeroLeadDigitsArb(14, 30).map((text) => ({ text, error: 'OUT_OF_RANGE' as const })),
  // 13 digits, value 2^40 or more.
  fc.bigInt({ min: AMOUNT_BOUND_CENTS, max: 10n ** 13n - 1n }).map((v) => ({ text: v.toString(), error: 'OUT_OF_RANGE' as const })),
  // 2^40 itself and the values within 4 of 2^53.
  fc.constantFrom(AMOUNT_BOUND_CENTS, ...NEAR_2_POW_53).map((v) => ({ text: v.toString(), error: 'OUT_OF_RANGE' as const })),
);

const invalidCaseArb: fc.Arbitrary<InvalidCase> = fc.oneof(emptyCaseArb, notDigitsCaseArb, leadingZeroCaseArb, outOfRangeCaseArb);

describe('tamper_input_validation: invalid half', () => {
  it('tamper_input_validation: invalid text gets its class and a fixed message (P14)', () => {
    runProperty('tamper_input_validation invalid', { seed: 20264014, numRuns: 200 }, fc.property(invalidCaseArb, ({ text, error }) => {
      const result = parseAmountInput(text);
      expect(result).toEqual({ ok: false, error });
      expect(AMOUNT_INPUT_MESSAGES[error]).toBeTypeOf('string');
      expect(AMOUNT_INPUT_MESSAGES[error].length).toBeGreaterThan(0);
    }));
  });

  it('tamper_input_validation: every message is fixed, uppercase, and holds no digit or typed text', () => {
    expect(Object.keys(AMOUNT_INPUT_MESSAGES).sort()).toEqual([...ERROR_CLASSES].sort());
    for (const error of ERROR_CLASSES) {
      const message = AMOUNT_INPUT_MESSAGES[error];
      expect(message).toBe(message.toUpperCase());
      expect(message).not.toMatch(/[0-9]/);
      expect(message.length).toBeLessThanOrEqual(70);
    }
  });

  it('tamper_input_validation: the message never contains the typed text', () => {
    const planted = [
      SENTINEL_DIGITS,
      `-${SENTINEL_DIGITS}`,
      `${SENTINEL_DIGITS}.50`,
      `${SENTINEL_DIGITS}e3`,
      ` ${SENTINEL_DIGITS}`,
      `0${SENTINEL_DIGITS}`,
      `${SENTINEL_DIGITS}${SENTINEL_DIGITS}`,
      `${SENTINEL_DIGITS}x`,
    ];
    for (const text of planted) {
      const result = parseAmountInput(text);
      if (!result.ok) {
        const message = AMOUNT_INPUT_MESSAGES[result.error];
        expect(message).not.toContain(SENTINEL_DIGITS);
        expect(message).not.toContain(text);
      }
    }
  });

  it('tamper_input_validation: boundary values are rejected, not wrapped', () => {
    expectError('1099511627776', 'OUT_OF_RANGE');
    for (const value of NEAR_2_POW_53) expectError(value.toString(), 'OUT_OF_RANGE');
    // Near the field modulus: 77 digits.
    expectError('21888242871839275222246405745257275088548364400416034343698204186575808495617', 'OUT_OF_RANGE');
    expectError('21888242871839275222246405745257275088548364400416034343698204186575808495616', 'OUT_OF_RANGE');
  });

  it('tamper_input_validation: example per error class', () => {
    expectError('abc', 'NOT_DIGITS');
    expectError('-5', 'NOT_DIGITS');
    expectError('', 'EMPTY');
    expectError('007', 'LEADING_ZERO');
    expectError('12345678901234', 'OUT_OF_RANGE');
    expectError('9007199254740993', 'OUT_OF_RANGE');
    expectError('12.50', 'NOT_DIGITS');
    expectError('1e3', 'NOT_DIGITS');
    expectError(' 5', 'NOT_DIGITS');
    expectError('5 ', 'NOT_DIGITS');
  });

  it('tamper_input_validation: typed sentinel digits never appear in a rendered row', () => {
    // CTM100 is the only input screen of group 1. Its field is one cell wide, so only the first
    // typed character is kept, and no message may echo any part of the text.
    let state = onSelectScreen();
    state = typeText(state, SENTINEL_DIGITS);
    state = step(state, ENTER);
    for (const row of renderGrid(state)) {
      expect(row).not.toContain(SENTINEL_DIGITS);
    }
    expect(state.status).not.toContain(SENTINEL_DIGITS);
  });
});
