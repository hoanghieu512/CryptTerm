import { describe, expect, it } from 'vitest';
import { ProveError } from '../../src/zk/prove-service';
import { PROVE_STAGES } from '../../src/zk/worker-protocol';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig, flush, rejection } from '../support/prove-rig';

// Feature: zk-core, `worker_protocol` (Requirements 3.2, 4.1, 4.2, 4.3). Examples only, with the
// real service and worker core, an in-process port and a stub backend. No real proving.

const run = (rig: ReturnType<typeof createRig>) =>
  rig.service.proveBatch(sentinelBatch(), shapedDigest(), LIMIT, rig.onProgress);

function reasonOf(error: unknown): string {
  return error instanceof ProveError ? error.reason : 'NOT A ProveError';
}

describe('worker_protocol stages and BUSY', () => {
  it('worker_protocol: stages arrive once each, in the fixed order', async () => {
    const rig = createRig();
    await run(rig);
    expect(rig.stages).toStrictEqual([...PROVE_STAGES]);
    expect(rig.stages).toStrictEqual(['PRECHECK', 'WASM INIT', 'WITNESS PREP', 'EXECUTE', 'PROVE']);
  });

  it('worker_protocol: a second call while one runs rejects BUSY and leaves the run alone', async () => {
    const rig = createRig({ hold: true });
    const first = run(rig);
    await flush();
    expect(reasonOf(await rejection(run(rig)))).toBe('BUSY');
    expect(rig.ports).toHaveLength(1);
    rig.control.release();
    const bundle = await first;
    expect(bundle.batchId).toBe('CTB-20261201-001');
    expect(rig.control.counts.prove).toBe(1);
  });
});

// Messages that a cancelled run could still deliver: a progress event and a result.
function lateMessages(runId: number): unknown[] {
  const inputs = ['1', '2', '3'];
  return [
    { type: 'stage', runId, stage: 'PROVE' },
    { type: 'proved', runId, proof: new Uint8Array(32), publicInputs: inputs },
  ];
}

describe('worker_protocol cancel', () => {
  it('worker_protocol: cancel rejects CANCELLED, stops the worker and ignores its late messages', async () => {
    const rig = createRig({ hold: true });
    const first = run(rig);
    await flush();
    const oldRunId = rig.ports[0]?.requests[0]?.runId ?? -1;
    rig.service.cancelProve();
    expect(reasonOf(await rejection(first))).toBe('CANCELLED');
    expect(rig.ports[0]?.terminated).toBe(true);

    const second = run(rig);
    await flush();
    expect(rig.ports).toHaveLength(2);
    const progressBefore = rig.stages.length;
    for (const port of rig.ports) lateMessages(oldRunId).forEach((m) => port.emit(m));
    await flush();
    expect(rig.stages.length).toBe(progressBefore);

    rig.control.release();
    await expect(second).resolves.toMatchObject({ batchId: 'CTB-20261201-001' });
  });
});

describe('worker_protocol error hygiene', () => {
  it('worker_protocol: a worker error message with a sentinel reaches no event and no error', async () => {
    const rig = createRig({ failAt: 'prove', sentinel: 'S3NT1N3L918273645' });
    const error = await rejection(run(rig));
    expect(reasonOf(error)).toBe('PROVER_FAILED');
    const seen = JSON.stringify([rig.ports[0]?.events, rig.stages, String(error), Object.getOwnPropertyNames(error as Error)]);
    expect(seen).not.toContain('S3NT1N3L');
    expect(seen).not.toContain('918273645');
    expect('cause' in (error as Error)).toBe(false);
  });
});
