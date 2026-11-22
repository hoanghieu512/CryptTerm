import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVE_STAGES } from '../../src/zk/worker-protocol';
import { runProperty } from '../support/pbt';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig, flush } from '../support/prove-rig';

// Feature: zk-core, Property 13: Foreign run ids never act. Validates: Requirement 4.3.
// While a run is active, messages with another run id, and malformed messages, are delivered to
// the page. No promise settles because of them and no progress call is made.

const KINDS = ['stage', 'proved', 'verified', 'failed'] as const;
const ODD_IDS = [0, -1, 1.5, Number.NaN, 2 ** 53, Number.MAX_SAFE_INTEGER];

interface Foreign {
  readonly kind: (typeof KINDS)[number];
  readonly offset: number;
  readonly odd: boolean;
}

// The body of a well-formed event of each kind.
function bodyOf(kind: Foreign['kind']): object {
  switch (kind) {
    case 'stage':
      return { stage: 'PROVE' };
    case 'proved':
      return { proof: new Uint8Array(32), publicInputs: ['1', '2', '3'] };
    case 'verified':
      return { valid: true };
    case 'failed':
      return { code: 'PROVER_FAILED' };
  }
}

// A well-formed event whose run id is not the active one.
function foreignEvent(f: Foreign, active: number): unknown {
  const runId = f.odd ? ODD_IDS[f.offset % ODD_IDS.length] : active + 1 + f.offset;
  return { type: f.kind, runId, ...bodyOf(f.kind) };
}

// Messages that fail the shape guard, some of them carrying the active run id.
function malformed(active: number): readonly unknown[] {
  return [
    null,
    42,
    'proved',
    {},
    { type: 'proved' },
    { type: 'stage', runId: active },
    { type: 'proved', runId: active, proof: 'x', publicInputs: [] },
    { type: 'failed', runId: active, code: 'NOT A CODE' },
    { type: 'verified', runId: active, valid: 'yes' },
  ];
}

const foreignArb: fc.Arbitrary<Foreign> = fc.record({
  kind: fc.constantFrom(...KINDS),
  offset: fc.nat({ max: 5 }),
  odd: fc.boolean(),
});

const MESSAGE_ORDER = fc.array(fc.oneof(foreignArb, fc.nat({ max: 8 })), { minLength: 1, maxLength: 12 });

type Held = Foreign | number;

// A number picks one of the malformed messages, a record builds a foreign event.
function messageFor(item: Held, active: number): unknown {
  if (typeof item !== 'number') return foreignEvent(item, active);
  const bad = malformed(active);
  return bad[item % bad.length];
}

// One run with `held` messages delivered while it is pending. It must still finish normally.
async function checkIsolation(held: readonly Held[]): Promise<void> {
  const rig = createRig({ hold: true });
  let settled = false;
  const outcome = rig.service.proveBatch(sentinelBatch(), shapedDigest(), LIMIT, rig.onProgress);
  const markSettled = (): void => void (settled = true);
  void outcome.then(markSettled, markSettled);
  await flush();
  const active = rig.ports[0]?.requests[0]?.runId ?? -1;
  const stagesBefore = [...rig.stages];
  for (const item of held) rig.ports[0]?.emit(messageFor(item, active));
  await flush();
  expect(settled).toBe(false);
  expect(rig.stages).toStrictEqual(stagesBefore);
  rig.control.release();
  await expect(outcome).resolves.toMatchObject({ recordCount: 2 });
  expect(rig.stages).toStrictEqual([...PROVE_STAGES]);
}

describe('worker_run_id_isolation', () => {
  it('worker_run_id_isolation: foreign and malformed messages change nothing', async () => {
    const config = { seed: 20263013, numRuns: 100 };
    await runProperty('P13 worker_run_id_isolation', config, fc.asyncProperty(MESSAGE_ORDER, checkIsolation));
  });
});
