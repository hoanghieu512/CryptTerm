import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkBatch } from '../../src/ledger/check-batch';
import type { CheckReason } from '../../src/ledger/check-batch';
import { MESSAGES } from '../../src/ui/model/messages';
import { verdictRowOf as ctm300VerdictRow } from '../../src/ui/model/screens/ctm300';
import { verdictRowOf as ctm900VerdictRow, verdictText } from '../../src/ui/model/screens/ctm900';
import { verdictRowFor } from '../../src/ui/model/screens/index';
import type { PfNumber, TerminalState, VerifyOutcome } from '../../src/ui/model/types';
import { VERIFY_STEP_ORDER } from '../../src/ui/model/verify-flow';
import { TerminalView } from '../../src/ui/terminal-view';
import { PROVE_ERROR_MESSAGES } from '../../src/zk/prove-service';
import { checkCaseArb } from '../support/check-batch-arbitraries';
import { exampleBundle } from '../support/fake-prove';
import { GOOD_BATCH, ctm300, rowsOf, withDone } from '../support/prove-state';
import { stateOn } from '../support/terminal-arbitraries';

// Test verdict_row_inverse (release Requirements 3.3, 3.4). Every text comes from the model
// modules. The row index of the verdict is checked against the grid, and against the class that
// the view gives to the row.

const NO_PF = (_pf: PfNumber): void => undefined;
const STATUS_ROW = 24;

function rowText(state: TerminalState, row: number): string {
  return (rowsOf(state)[row - 1] ?? '').trimEnd();
}

function titleClassCount(state: TerminalState): number {
  const markup = renderToStaticMarkup(createElement(TerminalView, { state, onPf: NO_PF }));
  return (markup.match(/ct-row-title/g) ?? []).length;
}

function failedWith(message: string): TerminalState {
  return { ...ctm300(GOOD_BATCH), prove: { kind: 'failed', message }, status: message };
}

const ON_900 = stateOn('CTM900', GOOD_BATCH);

function withOutcome(outcome: VerifyOutcome): TerminalState {
  const verify = ON_900.verify;
  return { ...ON_900, verify: { ...verify, result: { outcome, limitText: ON_900.fields.limit ?? '', bundleSeq: verify.bundleSeq } } };
}

function verifying(): TerminalState {
  const verify = ON_900.verify;
  return { ...ON_900, verify: { ...verify, run: { runId: 1, limitText: ON_900.fields.limit ?? '', bundleSeq: verify.bundleSeq } } };
}

/** The reasons that `checkBatch` gives, found by running it over generated cases. */
function checkReasons(): CheckReason[] {
  const found = new Set<CheckReason>();
  for (const c of fc.sample(checkCaseArb, { seed: 20264403, numRuns: 300 })) {
    const result = checkBatch(c.batch, c.limitCents);
    if (!result.ok) found.add(result.reason);
  }
  return [...found];
}

describe('verdict_row_inverse', () => {
  it('verdict_row_inverse: CTM900 verdicts are on row 17 and in inverse video', () => {
    const texts: string[] = [];
    for (let passed = 0; passed <= VERIFY_STEP_ORDER.length; passed += 1) {
      const outcome: VerifyOutcome = { kind: 'report', passed, keyId: null };
      const state = withOutcome(outcome);
      const text = passed === VERIFY_STEP_ORDER.length ? 'VERIFIED' : `REJECTED AT ${VERIFY_STEP_ORDER[passed]}`;
      expect(verdictText(state, outcome)).toBe(text);
      texts.push(text);
      expect(ctm900VerdictRow(state)).toBe(17);
      expect(verdictRowFor(state)).toBe(17);
      expect(rowText(state, 17)).toBe(text);
      expect(titleClassCount(state)).toBe(2);
    }
    expect(texts).toHaveLength(VERIFY_STEP_ORDER.length + 1);
    const error = withOutcome({ kind: 'error' });
    expect(ctm900VerdictRow(error)).toBe(17);
    expect(rowText(error, 17)).toBe(MESSAGES.VERIFIER_ERROR);
    expect(titleClassCount(error)).toBe(2);
  });

  it('verdict_row_inverse: CTM300 done is row 8', () => {
    const state = withDone(ctm300(GOOD_BATCH), exampleBundle());
    expect(ctm300VerdictRow(state)).toBe(8);
    expect(verdictRowFor(state)).toBe(8);
    expect(rowText(state, 8)).toBe(MESSAGES.DONE);
    expect(titleClassCount(state)).toBe(2);
  });

  it('verdict_row_inverse: CTM300 failed is row 9, for every check reason and every prove error', () => {
    const reasons = checkReasons();
    expect(reasons.sort()).toEqual(['OUT_OF_RANGE', 'OVER_LIMIT_UNFLAGGED', 'UNBALANCED']);
    const messages = [
      ...reasons.map((reason) => `${MESSAGES.REJECTED}${reason}`),
      ...Object.values(PROVE_ERROR_MESSAGES),
      MESSAGES.UNEXPECTED,
    ];
    for (const message of messages) {
      const state = failedWith(message);
      expect(ctm300VerdictRow(state), message).toBe(9);
      expect(verdictRowFor(state), message).toBe(9);
      expect(rowText(state, 9), message).toBe(message);
      expect(rowText(state, 8), message).toBe('PROOF NOT GENERATED');
      expect(rowText(state, STATUS_ROW), message).toContain(message);
      expect(titleClassCount(state), message).toBe(2);
    }
  });

  it('verdict_row_inverse: no verdict row for idle, proving, VERIFYING and no outcome', () => {
    const idle = ctm300(GOOD_BATCH);
    const proving: TerminalState = { ...idle, prove: { kind: 'proving', runId: 1, stage: 'PRECHECK' } };
    const states: Record<string, TerminalState> = {
      'CTM300 idle': idle,
      'CTM300 proving': proving,
      'CTM900 verifying': verifying(),
      'CTM900 no outcome': ON_900,
      CTM000: stateOn('CTM000', GOOD_BATCH),
      CTM100: stateOn('CTM100', GOOD_BATCH),
      CTM200: stateOn('CTM200', GOOD_BATCH),
    };
    for (const [name, state] of Object.entries(states)) {
      expect(verdictRowFor(state), name).toBeNull();
      expect(titleClassCount(state), name).toBe(1);
    }
    expect(ctm300VerdictRow(idle)).toBeNull();
    expect(ctm300VerdictRow(proving)).toBeNull();
    expect(ctm900VerdictRow(verifying())).toBeNull();
    expect(ctm900VerdictRow(ON_900)).toBeNull();
  });

  it('verdict_row_inverse: the status row and a failed row 8 are never the verdict row', () => {
    const states = [
      failedWith(MESSAGES.UNEXPECTED),
      withDone(ctm300(GOOD_BATCH), exampleBundle()),
      withOutcome({ kind: 'report', passed: VERIFY_STEP_ORDER.length, keyId: null }),
    ];
    for (const state of states) {
      expect(verdictRowFor(state)).not.toBe(STATUS_ROW);
    }
    expect(verdictRowFor(failedWith(MESSAGES.UNEXPECTED))).not.toBe(8);
  });
});
