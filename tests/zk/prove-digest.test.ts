import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SignedDigest } from '../../src/ledger/digest';
import { FIELD_MODULUS } from '../../src/ledger/field';
import { parseBatch } from '../../src/ledger/parse';
import { ProveError } from '../../src/zk/prove-service';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig, rejection } from '../support/prove-rig';

// Feature: zk-core. prove_digest_invalid (Requirement 3.7) and prove_precheck_rejects (3.3).
// Each rejected case must stop on the page: no port is opened and only PRECHECK is reported.

const DIGEST_KEYS = ['batchId', 'merkleRoot', 'recordCount', 'signature', 'sourceKeyId'];
const rootHex = (root: bigint): string => `0x${root.toString(16).padStart(64, '0')}`;

// The cast is the point: these values break the SignedDigest type.
function broken(overrides: Record<string, unknown>): SignedDigest {
  return { ...shapedDigest(), ...overrides } as unknown as SignedDigest;
}

function withoutKey(key: string): SignedDigest {
  const copy: Record<string, unknown> = { ...shapedDigest() };
  delete copy[key];
  return copy as unknown as SignedDigest;
}

// Wrong types, bad patterns and bounds, one defect per digest.
const WRONG_FIELDS: readonly Record<string, unknown>[] = [
  { batchId: 5 },
  { merkleRoot: 7n },
  { recordCount: '2' },
  { signature: null },
  { sourceKeyId: 5 },
  { extra: 'field' },
];

const BAD_VALUES: readonly Record<string, unknown>[] = [
  { batchId: 'CTB-1' },
  { merkleRoot: '0'.repeat(64) },
  { merkleRoot: rootHex(FIELD_MODULUS) },
  { recordCount: 0 },
  { recordCount: 65 },
  { signature: '0'.repeat(127) },
  { sourceKeyId: 'a b' },
  { sourceKeyId: 'k'.repeat(65) },
];

const DIGEST_FIXED_MESSAGE = 'PROOF GENERATION FAILED: SIGNED DIGEST INVALID';

async function expectInvalidDigest(digest: SignedDigest): Promise<void> {
  const rig = createRig();
  const error = await rejection(rig.service.proveBatch(sentinelBatch(), digest, LIMIT, rig.onProgress));
  expect(error).toBeInstanceOf(ProveError);
  expect((error as ProveError).reason).toBe('DIGEST_INVALID');
  expect((error as ProveError).message).toBe(DIGEST_FIXED_MESSAGE);
  expect(rig.ports).toHaveLength(0);
  expect(rig.stages).toStrictEqual(['PRECHECK']);
}

describe('prove_digest_invalid', () => {
  it('prove_digest_invalid: a missing key, an extra key, a wrong type or a bad value is DIGEST_INVALID', async () => {
    for (const key of DIGEST_KEYS) await expectInvalidDigest(withoutKey(key));
    for (const overrides of [...WRONG_FIELDS, ...BAD_VALUES]) await expectInvalidDigest(broken(overrides));
  });
});

describe('prove_digest_invalid order', () => {
  it('prove_digest_invalid: a well-formed digest with another root is not DIGEST_INVALID', async () => {
    const rig = createRig();
    const other = shapedDigest({ merkleRoot: rootHex(123456789n) });
    const bundle = await rig.service.proveBatch(sentinelBatch(), other, LIMIT, rig.onProgress);
    expect(bundle.merkleRoot).toBe(123456789n);
  });

  it('prove_digest_invalid: a bad digest with a bad batch reports DIGEST_INVALID', async () => {
    const rig = createRig();
    const unbalanced = sentinelBatch(100n);
    const [first] = unbalanced.postings;
    const batch = { ...unbalanced, postings: first === undefined ? [] : [first] };
    const error = await rejection(rig.service.proveBatch(batch, broken({ recordCount: 0 }), LIMIT));
    expect((error as ProveError).reason).toBe('DIGEST_INVALID');
  });
});

function sample(name: string): { batch: ReturnType<typeof parseBatch>; digest: SignedDigest } {
  const path = (ext: string): string => fileURLToPath(new URL(`../../public/samples/${name}.${ext}`, import.meta.url));
  const batch = parseBatch(readFileSync(path('dat'), 'utf8'));
  return { batch, digest: JSON.parse(readFileSync(path('digest.json'), 'utf8')) as SignedDigest };
}

describe('prove_precheck_rejects', () => {
  it.each([
    ['unbalanced', 'UNBALANCED'],
    ['over-limit-unflagged', 'OVER_LIMIT_UNFLAGGED'],
  ])('prove_precheck_rejects: the %s sample is rejected as %s before any worker starts', async (name, reason) => {
    const rig = createRig();
    const { batch, digest } = sample(name);
    const error = await rejection(rig.service.proveBatch(batch, digest, LIMIT, rig.onProgress));
    expect((error as ProveError).reason).toBe(reason);
    expect(rig.ports).toHaveLength(0);
    expect(rig.stages).toStrictEqual(['PRECHECK']);
  });
});
