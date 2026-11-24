import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseAmountInput } from '../../src/ui/model/amount-input';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import type { Action, TerminalState } from '../../src/ui/model/types';
import { update } from '../../src/ui/model/update';
import { flush } from '../support/fake-verify';
import { runProperty } from '../support/pbt';
import { withLimitText } from '../support/prove-state';
import { TINY_BATCH, stateOn } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';
import type { Harness } from '../support/terminal-host';
import { STEP_NAMES, limitTextArb, malformedReportArb, runOpsArb, wellFormedReport } from '../support/verify-arbitraries';
import type { RunOp } from '../support/verify-arbitraries';

// Group 2 property tests of the verifier spec: the limit acceptance half (Property 5), one run at
// a time and the stale drop (Properties 10 and 11), and the fail-closed mapping (Property 12).
// The verifier is a fake that records its calls and settles on demand. Data is synthetic.

const VERDICT_ROW_INDEX = 16; // row 17, 0-based

function ctm900(): Harness {
  return makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
}

function gridOf(state: TerminalState): string[] {
  return renderGrid(state);
}

function rowsWith(state: TerminalState, word: string): number {
  return gridOf(state).filter((row) => row.includes(word)).length;
}

function verdictRow(state: TerminalState): string {
  return (gridOf(state)[VERDICT_ROW_INDEX] ?? '').trim();
}

/** Replaces the limit field text with the digits, by the screen's own keys. */
function typeLimit(h: Harness, digits: string): void {
  h.terminal.dispatch({ type: 'TAB', back: false });
  for (let i = 0; i < 13; i += 1) h.terminal.dispatch({ type: 'BACKSPACE' });
  for (const ch of digits) h.terminal.dispatch({ type: 'CHAR', ch });
}

describe('verify_limit_field_rules acceptance half', () => {
  // Feature: verifier, Property 5: Limit acceptance and refusal
  // **Validates: Requirements 2.3, 2.4, 2.5**
  it('verify_limit_field_rules: an accepted limit text calls the verifier once with BigInt(text)', () => {
    runProperty(
      'verify_limit_field_rules acceptance',
      { seed: 20264905, numRuns: 200 },
      fc.property(limitTextArb, (text) => {
        const h = makeHarness({ initial: withLimitText(stateOn('CTM900', TINY_BATCH), text) });
        h.terminal.dispatch({ type: 'ENTER' });
        const parsed = parseAmountInput(text);
        if (parsed.ok) {
          expect(h.verifier.calls).toHaveLength(1);
          expect(h.verifier.calls[0]?.limitCents).toBe(BigInt(text));
          expect(h.verifier.calls[0]?.limitCents).toBe(parsed.value);
          expect(h.terminal.getState().status).toBe(MESSAGES.VERIFYING);
        } else {
          expect(h.verifier.calls).toHaveLength(0);
          expect(h.terminal.getState().verify.run).toBeNull();
        }
      }),
    );
  });
});

/** The model that the interleaving property compares the screen with. */
interface Snapshot {
  readonly limit: string;
  readonly version: number;
}
interface Model {
  limit: string;
  version: number;
  run: (Snapshot & { readonly callIndex: number }) | null;
  shown: (Snapshot & { readonly shape: number }) | null;
}

function assertScreen(state: TerminalState, model: Model): void {
  const visible = model.shown !== null && model.shown.limit === model.limit && model.shown.version === model.version;
  const shape = visible && model.shown !== null ? model.shown.shape : -1;
  // The word VERIFIED is in the grid only for a visible pass, and then in exactly one row.
  expect(rowsWith(state, 'VERIFIED')).toBe(shape === 6 ? 1 : 0);
  if (visible && shape >= 0 && shape < 6) {
    expect(verdictRow(state)).toBe(`REJECTED AT ${STEP_NAMES[shape]}`);
  } else if (!visible) {
    expect(rowsWith(state, 'REJECTED AT')).toBe(0);
  }
}

describe('verify_single_run_and_stale_drop', () => {
  // Feature: verifier, Property 10: One run at a time
  // **Validates: Requirements 4.2**
  it('verify_single_run_and_stale_drop (Property 10): Enter during a run never calls a second time', () => {
    runProperty(
      'verify_single_run_and_stale_drop one run',
      { seed: 20264910, numRuns: 200 },
      fc.property(runOpsArb, fc.integer({ min: 1, max: 6 }), (ops, presses) => {
        const h = ctm900();
        h.terminal.dispatch({ type: 'ENTER' });
        expect(h.verifier.calls).toHaveLength(1);
        for (const op of ops) {
          if (op.kind === 'paste') h.terminal.dispatch({ type: 'PASTE_TEXT', text: op.text });
          else if (op.kind === 'limit') typeLimit(h, op.text);
          if (op.kind === 'enter' || op.kind === 'paste' || op.kind === 'limit') {
            h.terminal.dispatch({ type: 'ENTER' });
            expect(h.terminal.getState().status).toBe(MESSAGES.VERIFY_IN_PROGRESS);
          }
        }
        for (let i = 0; i < presses; i += 1) {
          h.terminal.dispatch({ type: 'ENTER' });
          expect(h.terminal.getState().status).toBe(MESSAGES.VERIFY_IN_PROGRESS);
        }
        expect(h.verifier.calls).toHaveLength(1);
      }),
    );
  });

  // Feature: verifier, Property 11: Stale results are dropped
  // **Validates: Requirements 4.3, 4.4**
  it('verify_single_run_and_stale_drop (Property 11): a verdict is shown only for the input that produced it', async () => {
    await runProperty(
      'verify_single_run_and_stale_drop stale drop',
      { seed: 20264911, numRuns: 200 },
      fc.asyncProperty(runOpsArb, async (ops: RunOp[]) => {
        const h = ctm900();
        const model: Model = { limit: '1000000', version: 0, run: null, shown: null };
        for (const op of ops) {
          const before = h.terminal.getState();
          if (op.kind === 'enter') {
            h.terminal.dispatch({ type: 'ENTER' });
            if (model.run !== null) {
              expect(h.terminal.getState().status).toBe(MESSAGES.VERIFY_IN_PROGRESS);
            } else if (parseAmountInput(model.limit).ok) {
              model.run = { limit: model.limit, version: model.version, callIndex: h.verifier.calls.length - 1 };
              model.shown = null;
              expect(h.terminal.getState().status).toBe(MESSAGES.VERIFYING);
            }
          } else if (op.kind === 'paste') {
            h.terminal.dispatch({ type: 'PASTE_TEXT', text: op.text });
            model.version += 1;
          } else if (op.kind === 'limit') {
            typeLimit(h, op.text);
            model.limit = op.text;
          } else if (op.kind === 'foreign') {
            const action: Action = { type: 'VERIFY_DONE', runId: 987_654, report: wellFormedReport(6), keyId: null };
            const result = update(before, action);
            expect(result.state).toBe(before);
            expect(result.effects).toEqual([]);
            expect(update(before, { type: 'VERIFY_FAILED', runId: 987_654 }).state).toBe(before);
          } else if (model.run !== null) {
            const run = model.run;
            h.verifier.resolve(wellFormedReport(op.shape), run.callIndex);
            await flush();
            model.run = null;
            const state = h.terminal.getState();
            expect(state.verify.run).toBeNull();
            if (run.limit === model.limit && run.version === model.version) {
              model.shown = { limit: run.limit, version: run.version, shape: op.shape };
              expect(state.status).toBe(MESSAGES.VERIFY_DONE);
            } else {
              expect(state.status).toBe(MESSAGES.INPUT_CHANGED);
              expect(state.verify.result).toBeNull();
            }
          }
          assertScreen(h.terminal.getState(), model);
        }
      }),
    );
  });

  it('verify_single_run_and_stale_drop: unchanged input stores the report, ends the run and accepts Enter again', async () => {
    const h = ctm900();
    h.terminal.dispatch({ type: 'ENTER' });
    h.verifier.resolve(wellFormedReport(6));
    await flush();
    const state = h.terminal.getState();
    expect(state.verify.run).toBeNull();
    expect(state.verify.result).not.toBeNull();
    expect(verdictRow(state)).toBe('VERIFIED');
    h.terminal.dispatch({ type: 'ENTER' });
    expect(h.verifier.calls).toHaveLength(2);
    expect(h.terminal.getState().status).toBe(MESSAGES.VERIFYING);
  });

  it('verify_single_run_and_stale_drop: an edit during a run drops the result and keeps the slot until it settles', async () => {
    const h = ctm900();
    h.terminal.dispatch({ type: 'ENTER' });
    h.terminal.dispatch({ type: 'PASTE_TEXT', text: 'EDITED-WHILE-RUNNING' });
    h.terminal.dispatch({ type: 'ENTER' });
    expect(h.terminal.getState().status).toBe(MESSAGES.VERIFY_IN_PROGRESS);
    expect(h.verifier.calls).toHaveLength(1);
    h.verifier.resolve(wellFormedReport(6));
    await flush();
    const state = h.terminal.getState();
    expect(state.status).toBe(MESSAGES.INPUT_CHANGED);
    expect(state.verify.run).toBeNull();
    expect(state.verify.result).toBeNull();
    expect(rowsWith(state, 'VERIFIED')).toBe(0);
    h.terminal.dispatch({ type: 'ENTER' });
    expect(h.verifier.calls).toHaveLength(2);
    expect(h.verifier.calls[1]?.text).toBe('EDITED-WHILE-RUNNING');
  });
});

const ERROR_TEXT = 'REJECTED: VERIFIER ERROR';

async function runAndSettle(h: Harness, settle: () => void): Promise<TerminalState> {
  h.terminal.dispatch({ type: 'ENTER' });
  settle();
  await flush();
  return h.terminal.getState();
}

function assertVerifierError(state: TerminalState): void {
  expect(state.verify.run).toBeNull();
  expect(verdictRow(state)).toBe(ERROR_TEXT);
  expect(state.status).toBe(ERROR_TEXT);
  expect(rowsWith(state, 'VERIFIED')).toBe(0);
}

describe('verify_fails_closed', () => {
  // Feature: verifier, Property 12: Fail closed
  // **Validates: Requirements 4.5**
  it('verify_fails_closed (Property 12): a malformed result or a rejection ends in REJECTED: VERIFIER ERROR', async () => {
    await runProperty(
      'verify_fails_closed',
      { seed: 20264912, numRuns: 200 },
      fc.asyncProperty(malformedReportArb, fc.anything(), fc.boolean(), async (report, reason, rejects) => {
        const h = ctm900();
        const state = await runAndSettle(h, () => {
          if (rejects) h.verifier.reject(reason);
          else h.verifier.resolve(report);
        });
        assertVerifierError(state);
      }),
    );
  });

  it('verify_fails_closed: a rejecting verifier', async () => {
    const h = ctm900();
    assertVerifierError(await runAndSettle(h, () => h.verifier.reject(new Error('SENTINEL-REJECTION'))));
    expect(gridOf(h.terminal.getState()).join('\n')).not.toContain('SENTINEL-REJECTION');
  });

  it('verify_fails_closed: a verifier that throws before it returns a promise', async () => {
    const h = ctm900();
    h.verifier.throwOnNextCall(new Error('SENTINEL-THROW'));
    h.terminal.dispatch({ type: 'ENTER' });
    await flush();
    assertVerifierError(h.terminal.getState());
    expect(gridOf(h.terminal.getState()).join('\n')).not.toContain('SENTINEL-THROW');
    h.terminal.dispatch({ type: 'ENTER' });
    expect(h.verifier.calls).toHaveLength(2);
  });

  it('verify_fails_closed: a null result', async () => {
    const h = ctm900();
    assertVerifierError(await runAndSettle(h, () => h.verifier.resolve(null)));
  });

  it('verify_fails_closed: an empty steps array', async () => {
    const h = ctm900();
    assertVerifierError(await runAndSettle(h, () => h.verifier.resolve({ verdict: 'REJECTED', steps: [] })));
  });

  it('verify_fails_closed: a VERIFIED verdict with five steps', async () => {
    const h = ctm900();
    const five = { verdict: 'VERIFIED', steps: wellFormedReport(6).steps.slice(0, 5) };
    assertVerifierError(await runAndSettle(h, () => h.verifier.resolve(five)));
  });
});
