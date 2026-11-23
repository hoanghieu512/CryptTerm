import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { checkInvariants } from '../../src/ledger/invariants';
import type { Cents, Posting } from '../../src/ledger/posting';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { AMOUNT_INPUT_MESSAGES, parseAmountInput } from '../../src/ui/model/amount-input';
import { renderGrid, renderStatusRow } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { layoutOf } from '../../src/ui/model/screens/index';
import { isTampered, pageSlots, workingBatch } from '../../src/ui/model/tamper';
import type { Action, TerminalState } from '../../src/ui/model/types';
import { amountArb, batchArb, SENTINEL } from '../support/ledger-arbitraries';
import { runProperty } from '../support/pbt';
import {
  ENTER,
  PAGE_SIZE_UNDER_TEST,
  committedSample,
  editSlot,
  loadedState,
  pf,
  pressUntilPage,
  step,
  submitTyped,
} from '../support/terminal-arbitraries';

// Tamper mode on CTM200. Edits go through the model: PF12, typed `amt:<slot>` text, Enter.

function posting(side: 0n | 1n, amountCents: bigint, n: bigint): Posting {
  return { recordId: n, account: 10n ** 15n + n, side, amountCents, reviewFlag: 0n, salt: n };
}
/** Balanced: debits 100 + 200, credits 150 + 150. */
const PAIR_BATCH: Batch = {
  batchId: 'CTB-20261201-001',
  postings: [posting(0n, 100n, 1n), posting(0n, 200n, 2n), posting(1n, 150n, 3n), posting(1n, 150n, 4n)],
};

type InputField = { readonly id: string; readonly row: number; readonly col: number; readonly length: number };
function inputsOf(state: TerminalState): InputField[] {
  return layoutOf(state).fields.flatMap((f) => (f.kind === 'input' ? [{ id: f.id, row: f.row, col: f.col, length: f.length }] : []));
}
const lastRow = (s: TerminalState): string => renderGrid(s)[23] ?? '';
const rowThree = (s: TerminalState): string => renderGrid(s)[2] ?? '';

describe('tamper_toggle', () => {
  it('tamper_toggle: PF12 makes one amount field per posting of the page, PF12 again removes them', () => {
    const off = loadedState(PAIR_BATCH);
    expect(off.tamper).toBe(false);
    expect(inputsOf(off)).toEqual([]);
    expect(renderGrid(off)[22]).toContain('PF12 TAMPER');
    expect(renderGrid(off)[4]).not.toContain('NEW CENTS');

    const on = step(off, pf(12));
    expect(on.tamper).toBe(true);
    expect(on.status).toBe(MESSAGES.TAMPER_ON);
    expect(inputsOf(on).map((f) => f.id)).toEqual(['amt:0', 'amt:1', 'amt:2', 'amt:3']);
    expect(inputsOf(on).every((f) => f.col === 67 && f.length === 13)).toBe(true);
    expect(inputsOf(on).map((f) => f.row)).toEqual([6, 7, 8, 9]);
    expect(on.cursor?.fieldId).toBe('amt:0');
    expect(renderGrid(on)[22]).toContain('PF12 END TAMPER');
    expect(renderGrid(on)[4]).toContain('NEW CENTS');

    const back = step(on, pf(12));
    expect(back.tamper).toBe(false);
    expect(back.status).toBe(MESSAGES.TAMPER_OFF);
    expect(inputsOf(back)).toEqual([]);
  });

  it('tamper_toggle: on page 2 the fields are the slots of that page, and a page change clears typed text', () => {
    const batch = committedSample('large').batch;
    const page1 = pressUntilPage(step(loadedState(batch), pf(12)), 1);
    expect(inputsOf(page1).map((f) => f.id)).toEqual(
      Array.from({ length: PAGE_SIZE_UNDER_TEST }, (_, i) => `amt:${PAGE_SIZE_UNDER_TEST + i}`),
    );
    expect(pageSlots(page1)).toEqual(Array.from({ length: PAGE_SIZE_UNDER_TEST }, (_, i) => PAGE_SIZE_UNDER_TEST + i));
    const typed = { ...page1, fields: { 'amt:12': '555' } };
    expect(step(typed, pf(8)).fields).toEqual({});
    expect(step(typed, pf(7)).fields).toEqual({});
    expect(step(typed, pf(8)).tamper).toBe(true);
  });

  it('tamper_toggle: Enter with tamper off goes to CTM300, with tamper on it stays on CTM200', () => {
    expect(step(loadedState(PAIR_BATCH), ENTER).screen).toBe('CTM300');
    expect(step(step(loadedState(PAIR_BATCH), pf(12)), ENTER).screen).toBe('CTM200');
  });
});

// ---------------------------------------------------------------------------------------------
// Atomic submit
// ---------------------------------------------------------------------------------------------

const invalidTextArb: fc.Arbitrary<string> = fc.constantFrom(
  'abc', '-5', '1.5', ' 5', '5 ', '1e3', '007', '00', '1099511627776', '9007199254740992', '9007199254740993', '12345678901234', `${SENTINEL}x`,
);
const validTextArb: fc.Arbitrary<string> = fc.bigInt({ min: 0n, max: AMOUNT_BOUND_CENTS - 1n }).map((v) => v.toString());
const typedTextArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constant('') },
  { weight: 4, arbitrary: validTextArb },
  { weight: 2, arbitrary: invalidTextArb },
);

// Feature: terminal-ui, Property 15: A rejected submit changes nothing
// **Validates: Requirements 5.4, 6.5**
describe('tamper_input_validation: atomic half', () => {
  it('tamper_input_validation: one invalid text rejects the whole submit (P15)', () => {
    runProperty(
      'tamper_input_validation atomic',
      { seed: 20264015, numRuns: 200 },
      fc.property(batchArb, fc.array(typedTextArb, { minLength: 1, maxLength: 12 }), invalidTextArb, fc.nat(), (batch, texts, bad, at) => {
        const ready0 = step(loadedState(batch), pf(12));
        const slots = pageSlots(ready0).slice(0, texts.length);
        const typed = texts.slice(0, slots.length);
        typed[at % slots.length] = bad;
        const fields: Record<string, string> = {};
        slots.forEach((slot, i) => {
          fields[`amt:${slot}`] = typed[i] as string;
        });
        const ready: TerminalState = { ...ready0, fields };
        const next = step(ready, ENTER);
        const firstBad = slots.findIndex((_, i) => typed[i] !== '' && !parseAmountInput(typed[i] as string).ok);
        const result = parseAmountInput(typed[firstBad] as string);
        expect(result.ok).toBe(false);
        expect(next.edits).toEqual(ready.edits);
        expect(next.edits.size).toBe(0);
        expect(next.prove).toEqual(ready.prove);
        expect(next.sample).toBe(ready.sample);
        expect(next.fields).toEqual(ready.fields);
        expect(next.screen).toBe('CTM200');
        expect(next.status).toBe(result.ok ? '' : AMOUNT_INPUT_MESSAGES[result.error]);
        expect(next.cursor?.fieldId).toBe(`amt:${slots[firstBad]}`);
        expect(next.status).not.toContain(SENTINEL);
      }),
    );
  });

  const classes: readonly (readonly [string, string, 'NOT_DIGITS' | 'LEADING_ZERO' | 'OUT_OF_RANGE'])[] = [
    ['letters', 'abc', 'NOT_DIGITS'],
    ['a sign', '-5', 'NOT_DIGITS'],
    ['a leading zero', '007', 'LEADING_ZERO'],
    ['2^40', '1099511627776', 'OUT_OF_RANGE'],
    ['near 2^53', '9007199254740993', 'OUT_OF_RANGE'],
  ];
  it.each(classes)('tamper_input_validation: %s shows the fixed message and keeps the cursor', (_label, text, error) => {
    const before = step(loadedState(PAIR_BATCH), pf(12));
    const next = submitTyped(before, { 1: text });
    expect(next.status).toBe(AMOUNT_INPUT_MESSAGES[error]);
    expect(next.edits.size).toBe(0);
    expect(next.cursor?.fieldId).toBe('amt:1');
    expect(next.fields['amt:1']).toBe(text);
  });

  it('tamper_input_validation: a valid text in another field is not applied either', () => {
    const next = submitTyped(step(loadedState(PAIR_BATCH), pf(12)), { 0: '99', 1: 'abc' });
    expect(next.edits.size).toBe(0);
    expect(next.sample?.batch).toStrictEqual(PAIR_BATCH);
    expect(next.status).toBe(AMOUNT_INPUT_MESSAGES.NOT_DIGITS);
    expect(next.cursor?.fieldId).toBe('amt:1');
    expect(next.fields['amt:0']).toBe('99');
  });

  it('tamper_input_validation: all fields empty says NO AMOUNT ENTERED and changes nothing', () => {
    const before = step(loadedState(PAIR_BATCH), pf(12));
    const next = step(before, ENTER);
    expect(next.status).toBe(MESSAGES.NO_EDITS);
    expect(next.edits.size).toBe(0);
    expect(next.tamper).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Accumulating edits
// ---------------------------------------------------------------------------------------------

/** A slot index (wrapped onto the batch) and an amount, or null for "the original amount". */
type Edit = readonly [number, Cents | null];
const editArb: fc.Arbitrary<Edit> = fc.tuple(fc.nat(), fc.oneof({ weight: 4, arbitrary: amountArb }, { weight: 1, arbitrary: fc.constant(null) }));

// Feature: terminal-ui, Property 16: Edits accumulate as the reference model says, and TAMPERED follows the difference
// **Validates: Requirements 6.2, 6.3**
describe('tamper_edits_accumulate', () => {
  it('tamper_edits_accumulate: the working batch equals the reference model, TAMPERED follows the difference (P16)', () => {
    runProperty('tamper_edits_accumulate', { seed: 20264016, numRuns: 200 }, fc.property(batchArb, fc.array(editArb, { maxLength: 5 }), (batch, edits) => {
      const original = structuredClone(batch);
      const ref = batch.postings.map((p) => ({ ...p }));
      let state = loadedState(batch);
      for (const [i, cents] of edits) {
        const slot = i % ref.length;
        const amount = cents ?? (batch.postings[slot] as Posting).amountCents;
        ref[slot] = { ...(ref[slot] as Posting), amountCents: amount };
        state = editSlot(state, slot, amount);
        expect(state.tamper).toBe(true);
      }
      const sample = state.sample;
      expect(sample?.batch).toStrictEqual(original);
      if (sample === null) throw new Error('FIXTURE: SAMPLE LOST');
      expect(workingBatch(sample, state.edits)).toStrictEqual({ batchId: batch.batchId, postings: ref });
      const differs = ref.some((p, i) => p.amountCents !== (batch.postings[i] as Posting).amountCents);
      expect(state.edits.size > 0).toBe(differs);
      expect(isTampered(state)).toBe(differs);
      for (const [slot, cents] of state.edits) expect(cents).not.toBe((batch.postings[slot] as Posting).amountCents);
      // CTM200
      expect(renderStatusRow(state).endsWith('TAMPERED')).toBe(differs);
      expect(rowThree(state).includes('TAMPERED')).toBe(differs);
      // CTM300 (tamper mode off first, then Enter)
      const off = state.tamper ? step(state, pf(12)) : state;
      const prove = step(off, ENTER);
      expect(prove.screen).toBe('CTM300');
      expect(lastRow(prove).endsWith('TAMPERED')).toBe(differs);
    }));
  });

  it('tamper_edits_accumulate: moving 1 cent between two postings keeps the batch balanced', () => {
    const before = step(loadedState(PAIR_BATCH), pf(12));
    const after = submitTyped(before, { 0: '99', 1: '201' });
    expect(after.status).toBe(MESSAGES.EDITS_APPLIED);
    expect(after.tamper).toBe(true);
    expect(after.fields).toEqual({});
    if (after.sample === null) throw new Error('FIXTURE: SAMPLE LOST');
    const working = workingBatch(after.sample, after.edits);
    expect(working.postings.map((p) => p.amountCents)).toEqual([99n, 201n, 150n, 150n]);
    expect(checkInvariants(working).balanced).toBe(true);
    expect(isTampered(after)).toBe(true);
  });

  it('tamper_edits_accumulate: a single 1-cent edit unbalances the batch, and a second edit adds to the first', () => {
    const one = editSlot(loadedState(PAIR_BATCH), 0, 101n);
    if (one.sample === null) throw new Error('FIXTURE: SAMPLE LOST');
    expect(checkInvariants(workingBatch(one.sample, one.edits)).balanced).toBe(false);
    const two = editSlot(one, 3, 149n);
    if (two.sample === null) throw new Error('FIXTURE: SAMPLE LOST');
    expect(workingBatch(two.sample, two.edits).postings.map((p) => p.amountCents)).toEqual([101n, 200n, 150n, 149n]);
  });
});

describe('tamper_status', () => {
  it('tamper_status: TAMPERED shows on CTM200 and CTM300 while edited and disappears when reverted', () => {
    const edited = editSlot(loadedState(PAIR_BATCH), 0, 101n);
    expect(lastRow(edited).endsWith('TAMPERED')).toBe(true);
    const prove = step(step(edited, pf(12)), ENTER);
    expect(prove.screen).toBe('CTM300');
    expect(lastRow(prove).endsWith('TAMPERED')).toBe(true);
    const back = step(prove, pf(3));
    expect(back.screen).toBe('CTM200');
    expect(lastRow(back).endsWith('TAMPERED')).toBe(true);
    const reverted = editSlot(back, 0, 100n);
    expect(reverted.edits.size).toBe(0);
    expect(isTampered(reverted)).toBe(false);
    expect(renderGrid(reverted).join('\n')).not.toContain('TAMPERED');
  });
});

// ---------------------------------------------------------------------------------------------
// The original digest
// ---------------------------------------------------------------------------------------------

const tamperActionArb: fc.Arbitrary<Action> = fc.oneof(
  { weight: 3, arbitrary: fc.constant<Action>(pf(12)) },
  { weight: 2, arbitrary: fc.constantFrom<Action>(pf(7), pf(8), pf(3)) },
  { weight: 6, arbitrary: fc.constantFrom('0', '1', '5', '9', 'x').map((ch): Action => ({ type: 'CHAR', ch })) },
  { weight: 4, arbitrary: fc.constant<Action>(ENTER) },
  { weight: 2, arbitrary: fc.boolean().map((back): Action => ({ type: 'TAB', back })) },
  { weight: 1, arbitrary: fc.constant<Action>({ type: 'BACKSPACE' }) },
);

// Feature: terminal-ui, Property 17: The original digest never changes
// **Validates: Requirements 6.4**
describe('tamper_keeps_digest', () => {
  it('tamper_keeps_digest: the digest object and its content are the same after any action sequence (P17)', () => {
    runProperty('tamper_keeps_digest', { seed: 20264017, numRuns: 200 }, fc.property(batchArb, fc.array(tamperActionArb, { maxLength: 30 }), (batch, actions) => {
      const start = loadedState(batch, true);
      const digest = start.sample?.digest;
      expect(digest).toBeDefined();
      const content = structuredClone(digest);
      let state = start;
      for (const action of actions) {
        state = step(state, action);
        if (state.sample === null) continue; // left through PF3: no sample, no digest to change
        expect(state.sample.digest).toBe(digest);
        expect(state.sample.signatureValid).toBe(true);
      }
      expect(digest).toStrictEqual(content);
      expect(Object.isFrozen(digest)).toBe(true);
    }));
  });
});
