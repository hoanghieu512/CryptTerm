import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../src/ui/model/messages';
import { verdictText } from '../../src/ui/model/screens/ctm900';
import type { TerminalState } from '../../src/ui/model/types';
import { VERIFY_STEP_ORDER, normalizeReport, onVerifyDone, verifyShown } from '../../src/ui/model/verify-flow';
import { VERIFY_DETAILS } from '../../src/zk/verifier';
import type { VerifyStepName } from '../../src/zk/verifier';
import { GOOD_BATCH } from '../support/prove-state';
import { runProperty } from '../support/pbt';
import { stateOn } from '../support/terminal-arbitraries';

// Feature: verify-error, Property 3: The Verify_Model shows VERIFIER ERROR only for a check that did
// not finish (ctm900_verifier_error_row). Validates: Requirements 2.7, 2.8, 2.10.
// The reports are built by hand. The not-completed text is written as a literal on purpose, so this
// test does not depend on the export of the source.
const NOT_COMPLETED_TEXT = 'PROOF CHECK NOT COMPLETED';
const INVALID_TEXT = 'PROOF INVALID';

interface Step {
  readonly name: VerifyStepName;
  readonly ok: boolean;
  readonly detail: string;
}

// A well-formed report: steps before `failAt` pass, step `failAt` fails with `failDetail`. A
// `failAt` of 6 is a report with six passed steps.
function reportOf(failAt: number, failDetail: string): { verdict: string; steps: Step[] } {
  const steps: Step[] = [];
  for (let i = 0; i < Math.min(failAt + 1, VERIFY_STEP_ORDER.length); i += 1) {
    const name = VERIFY_STEP_ORDER[i] as VerifyStepName;
    steps.push(i < failAt ? { name, ok: true, detail: VERIFY_DETAILS[name].ok } : { name, ok: false, detail: failDetail });
  }
  return { verdict: failAt >= VERIFY_STEP_ORDER.length ? 'VERIFIED' : 'REJECTED', steps };
}

const ON_900 = stateOn('CTM900', GOOD_BATCH);

// The state with one run in flight, as startVerify leaves it.
function running(): TerminalState {
  const verify = ON_900.verify;
  return { ...ON_900, verify: { ...verify, run: { runId: 1, limitText: ON_900.fields.limit ?? '', bundleSeq: verify.bundleSeq } } };
}

// Delivers the report through the real VERIFY_DONE path and returns the stored outcome and the verdict text.
function settled(report: unknown): { state: TerminalState; verdict: string | null } {
  const { state } = onVerifyDone(running(), { type: 'VERIFY_DONE', runId: 1, report, keyId: null });
  return { state, verdict: verdictText(state, verifyShown(state)) };
}

interface Case {
  readonly failAt: number;
  readonly failDetail: string;
}

// Every case the property draws: a failure at each of the six steps, with the fixed fail text of the
// step, and at PROOF with each of the two PROOF texts. Earlier steps also get both PROOF texts as
// their detail, to show that the text matters only on the PROOF step. `failAt` 6 is a pass.
const caseArb: fc.Arbitrary<Case> = fc.oneof(
  fc.integer({ min: 0, max: 4 }).chain((failAt) =>
    fc
      .constantFrom(VERIFY_DETAILS[VERIFY_STEP_ORDER[failAt] as VerifyStepName].fail, INVALID_TEXT, NOT_COMPLETED_TEXT)
      .map((failDetail) => ({ failAt, failDetail })),
  ),
  fc.constantFrom(INVALID_TEXT, NOT_COMPLETED_TEXT).map((failDetail) => ({ failAt: 5, failDetail })),
  fc.constant({ failAt: 6, failDetail: VERIFY_DETAILS.PROOF.ok }),
);

function checkCase({ failAt, failDetail }: Case): void {
  const report = reportOf(failAt, failDetail);
  const { state, verdict } = settled(report);
  const outcome = state.verify.result?.outcome;
  expect(state.verify.run).toBeNull();

  if (failAt === 6) {
    // Six passed steps: the only report that shows VERIFIED.
    expect(outcome).toStrictEqual({ kind: 'report', passed: 6, keyId: null });
    expect(verdict).toBe('VERIFIED');
    return;
  }
  expect(verdict).not.toBe('VERIFIED');
  if (failAt === 5 && failDetail === NOT_COMPLETED_TEXT) {
    expect(normalizeReport(report)).toBeNull();
    expect(outcome).toStrictEqual({ kind: 'error' });
    expect(verdict).toBe(MESSAGES.VERIFIER_ERROR);
    return;
  }
  expect(normalizeReport(report)).toBe(failAt);
  expect(outcome).toMatchObject({ kind: 'report', passed: failAt });
  expect(verdict).toBe(`REJECTED AT ${VERIFY_STEP_ORDER[failAt]}`);
}

describe('ctm900_verifier_error_row', () => {
  it('ctm900_verifier_error_row: VERIFIER ERROR only for PROOF not completed, REJECTED AT <STEP> otherwise', () => {
    runProperty('verify-error P3 ctm900_verifier_error_row', { seed: 20265103, numRuns: 200 }, fc.property(caseArb, checkCase));
  });

  it('ctm900_verifier_error_row: a PROOF failure that did not finish shows the verifier error text', () => {
    const { state, verdict } = settled(reportOf(5, NOT_COMPLETED_TEXT));
    expect(state.verify.result?.outcome).toStrictEqual({ kind: 'error' });
    expect(verdict).toBe('REJECTED: VERIFIER ERROR');
  });

  it('ctm900_verifier_error_row: a PROOF failure with PROOF INVALID shows REJECTED AT PROOF', () => {
    const { state, verdict } = settled(reportOf(5, INVALID_TEXT));
    expect(state.verify.result?.outcome).toMatchObject({ kind: 'report', passed: 5 });
    expect(verdict).toBe('REJECTED AT PROOF');
  });
});
