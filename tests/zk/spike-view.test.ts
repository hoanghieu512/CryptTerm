import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/zk/spike-protocol';
import type { FailReason, Stage, WorkerToPage } from '../../src/zk/spike-protocol';
import {
  COPY,
  INITIAL_STATE,
  controlsDisabled,
  reduce,
  reasonText,
  render,
  stageSum,
} from '../../src/zk/spike-view';
import type { ViewEvent, ViewState } from '../../src/zk/spike-view';

// Requirements 8.5, 8.9, 8.13, 8.14, 8.15, 8.16, 9.8. Example test of the pure view model.
const CONTEXT = { totalMs: 16427.2, pageIsolated: false };

function msg(message: WorkerToPage): ViewEvent {
  return { type: 'worker-message', message, context: CONTEXT };
}

function apply(events: readonly ViewEvent[], from: ViewState = INITIAL_STATE): ViewState {
  return events.reduce(reduce, from);
}

function stageEvents(stages: readonly Stage[]): ViewEvent[] {
  return stages.flatMap((stage, i) => [
    msg({ type: 'stage-start', stage }),
    msg({ type: 'stage-end', stage, ms: 100.7 + i * 50.3 }),
  ]);
}

const DONE = msg({ type: 'done', proofBytes: 14656, workerIsolated: false });
const SUCCESS = apply([{ type: 'run' }, ...stageEvents(STAGES), DONE]);

describe('controls (8.14)', () => {
  it('disables both controls exactly while a run is in progress', () => {
    expect(render(INITIAL_STATE).controlsDisabled).toBe(false);
    const running = reduce(INITIAL_STATE, { type: 'run' });
    expect(controlsDisabled(running)).toBe(true);
    expect(render(running).controlsDisabled).toBe(true);
    expect(render(SUCCESS).controlsDisabled).toBe(false);
  });

  it('ignores a second run or run-invalid event while running', () => {
    const running = reduce(INITIAL_STATE, { type: 'run' });
    expect(reduce(running, { type: 'run' })).toBe(running);
    expect(reduce(running, { type: 'run-invalid' })).toBe(running);
  });

  it('drops worker events when no run is in progress', () => {
    expect(reduce(SUCCESS, { type: 'worker-error' })).toBe(SUCCESS);
    expect(reduce(SUCCESS, { type: 'timeout' })).toBe(SUCCESS);
    expect(reduce(INITIAL_STATE, DONE)).toBe(INITIAL_STATE);
  });
});

const FAILED_PROVE = apply([
  { type: 'run' },
  ...stageEvents(['WASM INIT', 'WITNESS PREP', 'EXECUTE']),
  msg({ type: 'stage-start', stage: 'PROVE' }),
  msg({ type: 'failed', stage: 'PROVE', reason: 'PROVER_ERROR', workerIsolated: false }),
]);

describe('failure view (8.9)', () => {
  it('keeps the completed stage rows and shows no total or proof size', () => {
    const view = render(FAILED_PROVE);
    const labels = view.rows.map((r) => r.label);
    expect(labels).toEqual(['WASM INIT', 'WITNESS PREP', 'EXECUTE']);
    expect(labels).not.toContain(COPY.TOTAL);
    expect(labels).not.toContain(COPY.PROOF_SIZE);
    expect(view.statusLine).toBe('FAILED PROVE: PROOF GENERATION ERROR');
    expect(view.controlsDisabled).toBe(false);
  });

  it('turns a worker error into a failure of the running stage', () => {
    const running = apply([{ type: 'run' }, msg({ type: 'stage-start', stage: 'EXECUTE' })]);
    const failed = reduce(running, { type: 'worker-error' });
    expect(render(failed).statusLine).toBe('FAILED EXECUTE: WORKER REPORTED AN ERROR');
  });
  it('fails closed when done arrives before all five stages finished', () => {
    const early = apply([{ type: 'run' }, ...stageEvents(['WASM INIT']), DONE]);
    expect(render(early).statusLine).toContain(COPY.FAILED);
    expect(render(early).rows.map((r) => r.label)).not.toContain(COPY.TOTAL);
  });
});

function rowValue(state: ViewState, label: string): string | undefined {
  return render(state).rows.find((r) => r.label === label)?.value;
}

describe('success view (8.15, 8.5)', () => {
  it('shows VERIFIED and never the word FAILED', () => {
    const view = render(SUCCESS);
    expect(view.statusLine).toBe(COPY.VERIFIED);
    const cells = view.rows.flatMap((r) => [r.label, r.value]);
    const text = [view.statusLine, view.detailLine ?? '', ...cells].join(' ');
    expect(text).not.toContain(COPY.FAILED);
    expect(rowValue(SUCCESS, COPY.PROOF_SIZE)).toBe('14656');
  });

  it('shows the isolation rows as FALSE when the context says not isolated', () => {
    expect(rowValue(SUCCESS, COPY.ISOLATED_PAGE)).toBe(COPY.FALSE);
    expect(rowValue(SUCCESS, COPY.ISOLATED_WORKER)).toBe(COPY.FALSE);
  });

  it('shows whole-number timings and a total of at least the stage sum', () => {
    for (const stage of STAGES) expect(rowValue(SUCCESS, stage)).toMatch(/^\d+ MS$/);
    expect(rowValue(SUCCESS, COPY.TOTAL)).toBe('16428 MS');
    const total = Number.parseInt(rowValue(SUCCESS, COPY.TOTAL) ?? '', 10);
    expect(total).toBeGreaterThanOrEqual(stageSum(SUCCESS));
  });
});

function words(text: string): number {
  return text.trim().split(/\s+/).length;
}

function copyStrings(): string[] {
  const out: string[] = [];
  for (const value of Object.values(COPY)) {
    if (typeof value === 'string') out.push(value);
    else out.push(...Object.values(value));
  }
  return out;
}

describe('copy table (8.13)', () => {
  it('has only uppercase strings of at most ten words', () => {
    const all = copyStrings();
    expect(all.length).toBeGreaterThan(50);
    for (const text of all) {
      expect(text).toBe(text.toUpperCase());
      expect(words(text)).toBeLessThanOrEqual(10);
    }
  });

  it('keeps every failure status line uppercase and within ten words', () => {
    const reasons: FailReason[] = [
      'FETCH', 'SRS_HASH', 'SRS_REJECTED', 'WASM_ERROR', 'FIELD_RANGE',
      'CONSTRAINT', 'SRS_TOO_SMALL', 'PROVER_ERROR', 'PROOF_REJECTED', 'VERIFIER_ERROR',
    ];
    const fields = [...Object.keys(COPY.FIELD_LABELS), 'unknown'];
    const lines: string[] = [];
    for (const stage of STAGES) {
      for (const reason of reasons) {
        for (const field of fields) {
          for (const slot of [undefined, 0, 12, 63]) {
            const failed = msg({ type: 'failed', stage, reason, workerIsolated: false, field, slot });
            lines.push(render(apply([{ type: 'run' }, failed])).statusLine);
          }
        }
      }
    }
    expect(Math.max(...lines.map(words))).toBe(10);
    for (const line of lines) expect(line).toBe(line.toUpperCase());
    expect(lines).toContain('FAILED WITNESS PREP: REVIEW FLAG OUT OF RANGE SLOT 12');
  });

  it('never echoes an unknown field name or an odd slot number', () => {
    expect(reasonText('FIELD_RANGE', 'secret-name', 12)).toBe('FIELD OUT OF RANGE SLOT 12');
    expect(reasonText('FIELD_RANGE', 'amountCents', 1000)).toBe('AMOUNT OUT OF RANGE');
    expect(reasonText('FIELD_RANGE', 'limitCents')).toBe('LIMIT OUT OF RANGE');
    expect(reasonText('WORKER_ERROR')).toBe(COPY.FAIL_WORKER_ERROR);
  });
});

const REPORT: WorkerToPage = {
  type: 'invalid-report',
  workerIsolated: false,
  report: {
    threw: true,
    returnedWitness: false,
    error: {
      typeofThrown: 'object',
      ctorName: 'Error',
      ownPropertyNames: ['stack', 'message'],
      message: 'Circuit execution failed: DEBITS NOT EQUAL TO CREDITS',
    },
    leaked: [],
    proof: null,
  },
};
const INVALID_STAGES: Stage[] = ['WASM INIT', 'WITNESS PREP', 'EXECUTE'];
const INVALID_DONE = apply([{ type: 'run-invalid' }, ...stageEvents(INVALID_STAGES), msg(REPORT)]);
const TIMED_OUT = apply([
  { type: 'run-invalid' },
  ...stageEvents(['WASM INIT']),
  { type: 'timeout' },
]);

describe('demo label (8.16)', () => {
  it('is present in every state', () => {
    const running = reduce(INITIAL_STATE, { type: 'run' });
    const states = [INITIAL_STATE, running, SUCCESS, FAILED_PROVE, INVALID_DONE, TIMED_OUT];
    for (const state of states) expect(render(state).demoLabel).toBe('DEMO DATA');
  });
});

describe('failure before execute and timeout (9.8)', () => {
  it('show no behaviour report values and leave the controls usable', () => {
    const fetchFailed = msg({ type: 'failed', stage: 'WASM INIT', reason: 'FETCH', workerIsolated: false });
    const early = apply([{ type: 'run-invalid' }, fetchFailed]);
    for (const state of [early, TIMED_OUT]) {
      const view = render(state);
      expect(view.controlsDisabled).toBe(false);
      expect(view.rawErrorMessage).toBeNull();
      expect(view.rawProofErrorMessage).toBeNull();
      expect(view.rows.map((r) => r.label)).not.toContain(COPY.EXECUTE_THREW);
    }
  });

  it('shows the timeout text, and ignores a timeout during a valid run', () => {
    expect(render(TIMED_OUT).statusLine).toBe('FAILED INVALID WITNESS RUN: TIMEOUT');
    expect(render(TIMED_OUT).detailLine).toBe(COPY.TIMEOUT);
    const valid = reduce(INITIAL_STATE, { type: 'run' });
    expect(reduce(valid, { type: 'timeout' })).toBe(valid);
  });

  it('shows the report rows and the raw message when the invalid run finishes', () => {
    const view = render(INVALID_DONE);
    expect(view.statusLine).toBe(COPY.INVALID_RUN_FINISHED);
    expect(rowValue(INVALID_DONE, COPY.EXECUTE_THREW)).toBe(COPY.YES);
    expect(rowValue(INVALID_DONE, COPY.RETURNED_WITNESS)).toBe(COPY.NO);
    expect(rowValue(INVALID_DONE, COPY.ERROR_CONSTRUCTOR)).toBe('Error');
    expect(rowValue(INVALID_DONE, COPY.PRIVATE_VALUE_IN_ERROR)).toBe(COPY.NO);
    expect(view.rawErrorMessage).toBe('Circuit execution failed: DEBITS NOT EQUAL TO CREDITS');
  });
});
