import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkBatch } from '../../src/ledger/check-batch';
import type { Batch } from '../../src/ledger/batch';
import { ProveError, PROVE_ERROR_MESSAGES } from '../../src/zk/prove-service';
import type { ProveReason } from '../../src/zk/prove-service';
import { PROVE_STAGES } from '../../src/zk/worker-protocol';
import { AMOUNT_INPUT_MESSAGES } from '../../src/ui/model/amount-input';
import { MESSAGES } from '../../src/ui/model/messages';
import { checkCaseArb } from '../support/check-batch-arbitraries';
import { tick } from '../support/fake-prove';
import { runProperty } from '../support/pbt';
import { PLANT, ctm300, pressProve, proveEffects, rowsOf, withBatch, withLimitText } from '../support/prove-state';
import { pf } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';

// Independent reference for the limit text: digits only, no leading zero, 13 digits at most, below 2^40.
function referenceLimit(text: string): bigint | null {
  if (!/^(0|[1-9][0-9]{0,12})$/.test(text)) return null;
  const value = BigInt(text);
  return value < 2n ** 40n ? value : null;
}

const BAD_LIMIT_TEXTS = ['', 'abc', '-1', '007', '1.5', '1e3', ' 5', '1099511627776', '12345678901234', '9007199254740993'];

interface ProveCase {
  readonly batch: Batch;
  readonly limitText: string;
}

const proveCaseArb: fc.Arbitrary<ProveCase> = fc
  .tuple(checkCaseArb, fc.boolean(), fc.constantFrom(...BAD_LIMIT_TEXTS))
  .map(([c, useBad, bad]) => ({
    batch: c.batch,
    limitText: !useBad && typeof c.limitCents === 'bigint' && c.limitCents >= 0n ? c.limitCents.toString() : bad,
  }));

describe('precheck_rejects_without_worker', () => {
  // Feature: terminal-ui, Property 18: A refused batch never reaches the Prove_Port
  it('precheck_rejects_without_worker: a refused batch or limit leaves the fake port with zero calls (P18)', () => {
    runProperty('terminal-ui P18 precheck_rejects_without_worker', { seed: 20264018, numRuns: 200 }, fc.property(proveCaseArb, ({ batch, limitText }) => {
      const state = withBatch(withLimitText(ctm300(), limitText), batch);
      const limit = referenceLimit(limitText);
      const pure = pressProve(state);
      const h = makeHarness({ initial: state });
      h.terminal.dispatch(pf(5));
      const after = h.terminal.getState();

      if (limit === null) {
        expect(h.fake.calls).toHaveLength(0);
        expect(pure.effects).toEqual([]);
        expect(Object.values(AMOUNT_INPUT_MESSAGES)).toContain(after.status);
        return;
      }
      const checked = checkBatch(batch, limit);
      if (!checked.ok) {
        expect(h.fake.calls).toHaveLength(0);
        expect(pure.effects).toEqual([]);
        expect(after.status).toBe(`${MESSAGES.REJECTED}${checked.reason}`);
        expect(after.prove.kind).toBe('failed');
        return;
      }
      const effects = proveEffects(pure.effects);
      expect(pure.effects).toHaveLength(1);
      expect(effects).toHaveLength(1);
      expect(effects[0]?.batch).toStrictEqual(batch);
      expect(effects[0]?.digest).toBe(state.sample?.digest);
      expect(effects[0]?.limitCents).toBe(limit);
      expect(h.fake.calls).toHaveLength(1);
      expect(h.fake.calls[0]?.batch).toStrictEqual(batch);
      expect(h.fake.calls[0]?.limitCents).toBe(limit);
      expect(after.prove.kind).toBe('proving');
    }));
  });
});

describe('single_proof_at_a_time', () => {
  type Op = 'press' | (typeof PROVE_STAGES)[number];
  const opArb: fc.Arbitrary<Op> = fc.oneof(
    { weight: 3, arbitrary: fc.constant<Op>('press') },
    { weight: 2, arbitrary: fc.constantFrom<Op>(...PROVE_STAGES) },
  );

  // Feature: terminal-ui, Property 19: One proof at a time
  it('single_proof_at_a_time: any number of PF5 presses and progress reports gives exactly one proveBatch call (P19)', () => {
    runProperty('terminal-ui P19 single_proof_at_a_time', { seed: 20264019, numRuns: 200 }, fc.property(fc.array(opArb, { maxLength: 24 }), (ops) => {
      const h = makeHarness({ initial: ctm300() });
      h.terminal.dispatch(pf(5));
      const first = h.terminal.getState().prove;
      const runId = first.kind === 'proving' ? first.runId : -1;
      expect(runId).toBeGreaterThan(0);
      for (const op of ops) {
        if (op === 'press') {
          h.terminal.dispatch(pf(5));
          expect(h.terminal.getState().status).toBe(MESSAGES.IN_PROGRESS);
        } else {
          h.fake.progress(op);
        }
        expect(h.fake.calls).toHaveLength(1);
        const prove = h.terminal.getState().prove;
        expect(prove.kind === 'proving' ? prove.runId : -1).toBe(runId);
      }
    }));
  });
});

const NINE_REASONS: readonly ProveReason[] = [
  'BUSY', 'CANCELLED', 'UNBALANCED', 'OVER_LIMIT_UNFLAGGED', 'OUT_OF_RANGE',
  'DIGEST_INVALID', 'ASSET_FAILED', 'WITNESS_FAILED', 'PROVER_FAILED',
];

// Values that are not a ProveError with a known reason. Each one plants the sentinel where it can.
const thrownArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string().map((s) => `${PLANT}${s}`),
  fc.constant(0).map(() => new Error(PLANT)),
  fc.constant(0).map(() => ({ message: PLANT, reason: 'BUSY' })),
  fc.constantFrom(undefined, null, 42, true),
  fc.constantFrom('__proto__', 'toString', 'constructor', 'hasOwnProperty', PLANT).map((reason) => Object.assign(new ProveError('BUSY'), { reason })),
);

describe('prove_error_display', () => {
  it('prove_error_display: the table holds exactly the nine reasons', () => {
    expect(Object.keys(PROVE_ERROR_MESSAGES).sort()).toEqual([...NINE_REASONS].sort());
  });

  it.each(NINE_REASONS)('prove_error_display: %s shows its fixed message, ends the run and accepts PF5 again', async (reason) => {
    const h = makeHarness({ initial: ctm300() });
    h.terminal.dispatch(pf(5));
    h.fake.reject(new ProveError(reason));
    await tick();
    const state = h.terminal.getState();
    expect(state.status).toBe(PROVE_ERROR_MESSAGES[reason]);
    expect(state.prove).toEqual({ kind: 'failed', message: PROVE_ERROR_MESSAGES[reason] });
    expect(rowsOf(state)[23]).toContain(PROVE_ERROR_MESSAGES[reason]);
    h.terminal.dispatch(pf(5));
    expect(h.fake.calls).toHaveLength(2);
    expect(h.terminal.getState().prove.kind).toBe('proving');
  });

  // Feature: terminal-ui, Property 20: Unexpected failures show fixed text only
  it('prove_error_display: any other thrown value shows the fixed text only, async or synchronous (P20)', async () => {
    await runProperty('terminal-ui P20 prove_error_display', { seed: 20264020, numRuns: 200 }, fc.asyncProperty(thrownArb, fc.boolean(), async (value, sync) => {
      const h = makeHarness({ initial: ctm300() });
      if (sync) h.fake.throwOnNextCall(value);
      h.terminal.dispatch(pf(5));
      if (!sync) {
        h.fake.reject(value);
        await tick();
      }
      const state = h.terminal.getState();
      expect(state.status).toBe(MESSAGES.UNEXPECTED);
      expect(state.prove.kind).toBe('failed');
      expect(rowsOf(state).join('\n')).not.toContain(PLANT);
      h.terminal.dispatch(pf(5));
      expect(h.fake.calls).toHaveLength(2);
      expect(h.terminal.getState().prove.kind).toBe('proving');
    }));
  });
});
