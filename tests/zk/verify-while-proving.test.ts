import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { createVerifier } from '../../src/zk/verifier';
import { createProofVerifier } from '../../src/zk/verify-client';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { createInProcessPort, createStubBackend } from '../support/in-process-port';
import type { InProcessPort } from '../support/in-process-port';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig, flush, rejection } from '../support/prove-rig';
import { POLICY_LIMIT, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, worker_protocol example for Requirement 8.6. The proof check of the verifier
// has its own worker instance, so a running proof neither blocks nor changes it. Stub backends.
let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

// A verifier whose proof check runs on its own in-process port, with a stub that accepts.
async function verifierSide() {
  const stub = createStubBackend({ verifyResult: true });
  const ports: InProcessPort[] = [];
  const openPort = (): InProcessPort => {
    const port = createInProcessPort(stub.backend);
    ports.push(port);
    return port;
  };
  const [base] = fc.sample(proofBundleArb, { seed: 2, numRuns: 1 });
  const bundle: ProofBundle = await signedBundle(key, base as ProofBundle);
  const verify = createVerifier(testDeps(key, createProofVerifier(openPort)));
  return { stub, ports, run: () => verify(bundleToJson(bundle), { limitCents: POLICY_LIMIT }) };
}

describe('worker_protocol verify while proving', () => {
  it('worker_protocol: the verifier completes on its own worker while a prove run is held', async () => {
    const rig = createRig({ hold: true });
    const proving = rig.service.proveBatch(sentinelBatch(), shapedDigest(), LIMIT, rig.onProgress);
    await flush();
    expect(rig.control.counts.prove).toBe(1);
    const side = await verifierSide();
    expect((await side.run()).verdict).toBe('VERIFIED');
    expect([side.ports.length, rig.ports.length]).toStrictEqual([1, 1]);
    expect([side.stub.control.counts.verify, rig.control.counts.openVerifier]).toStrictEqual([1, 0]);
    // The proof run is still held: a second one is refused, and the first one still finishes.
    const second = await rejection(rig.service.proveBatch(sentinelBatch(), shapedDigest(), LIMIT));
    expect((second as { reason: string }).reason).toBe('BUSY');
    rig.control.release();
    await expect(proving).resolves.toMatchObject({ batchId: 'CTB-20261201-001' });
  });
});
