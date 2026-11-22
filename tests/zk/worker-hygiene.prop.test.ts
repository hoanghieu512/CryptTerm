import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleToJson } from '../../src/zk/bundle';
import { createVerifier } from '../../src/zk/verifier';
import { createProofVerifier } from '../../src/zk/verify-client';
import type { WorkerPort } from '../../src/zk/worker-port';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { createInProcessPort, createStubBackend } from '../support/in-process-port';
import type { FailAt, InProcessPort } from '../support/in-process-port';
import { runProperty } from '../support/pbt';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig } from '../support/prove-rig';
import { POLICY_LIMIT, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, Property 14: Worker messages and errors hold no data. Validates: Requirement 4.5.
// A sentinel sits in every posting field and in the message of the error the stub throws. After
// the run, no event, progress argument, error property or report may contain either.
const ERROR_SENTINEL = 'S3NT1N3L918273645';
const DIGITS = '918273645';

// Everything an observer could read from a value: JSON text, bigints as decimals, own properties.
function surface(value: unknown): string {
  const replacer = (_key: string, v: unknown): unknown => (typeof v === 'bigint' ? v.toString(10) : v);
  const own = value instanceof Error ? Object.getOwnPropertyNames(value).map((n) => String((value as never)[n])) : [];
  return JSON.stringify([value, own], replacer);
}

function expectClean(...values: unknown[]): void {
  const text = values.map(surface).join('|');
  expect(text).not.toContain(ERROR_SENTINEL);
  expect(text).not.toContain(DIGITS);
}

async function outcomeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    return await promise;
  } catch (error) {
    return error;
  }
}

async function checkProvePath(failAt: FailAt | undefined): Promise<void> {
  const rig = createRig({ failAt, sentinel: ERROR_SENTINEL });
  const outcome = await outcomeOf(rig.service.proveBatch(sentinelBatch(), shapedDigest(), LIMIT, rig.onProgress));
  expectClean(outcome, rig.stages, rig.ports.map((port) => port.events));
  if (failAt !== undefined) expect(outcome).toBeInstanceOf(Error);
}

async function checkVerifyPath(failAt: FailAt | undefined, key: EphemeralKey): Promise<void> {
  const { backend } = createStubBackend({ failAt, sentinel: ERROR_SENTINEL });
  const ports: InProcessPort[] = [];
  const openPort = (): WorkerPort => {
    const port = createInProcessPort(backend);
    ports.push(port);
    return port;
  };
  const [base] = fc.sample(proofBundleArb, { seed: 5, numRuns: 1 });
  if (base === undefined) throw new Error('FIXTURE BUNDLE MISSING');
  const bundle = await signedBundle(key, base);
  const verify = createVerifier(testDeps(key, createProofVerifier(openPort)));
  const report = await verify(bundleToJson(bundle), { limitCents: POLICY_LIMIT });
  expectClean(report, ports.map((port) => port.events));
  expect(report.verdict).toBe(failAt === undefined ? 'VERIFIED' : 'REJECTED');
}

const PROVE_FAILS = fc.constantFrom<FailAt | undefined>(undefined, 'openProver', 'hash', 'execute', 'prove');
const VERIFY_FAILS = fc.constantFrom<FailAt | undefined>(undefined, 'openVerifier', 'verify');

let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

describe('worker_message_hygiene', () => {
  it('worker_message_hygiene: proving leaks no sentinel into events, progress or errors', async () => {
    const config = { seed: 20263014, numRuns: 100 };
    await runProperty('P14 hygiene prove', config, fc.asyncProperty(PROVE_FAILS, checkProvePath));
  });

  it('worker_message_hygiene: verifying leaks no sentinel into events or the report', async () => {
    const check = (failAt: FailAt | undefined): Promise<void> => checkVerifyPath(failAt, key);
    await runProperty('P14 hygiene verify', { seed: 20263140, numRuns: 100 }, fc.asyncProperty(VERIFY_FAILS, check));
  });
});
