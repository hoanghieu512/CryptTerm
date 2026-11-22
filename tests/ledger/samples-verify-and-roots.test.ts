import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyDigest } from '../../src/ledger/digest';
import { AMOUNT_BOUND_CENTS, CAPACITY } from '../../src/ledger/field';
import { checkInvariants } from '../../src/ledger/invariants';
import type { InvariantResult } from '../../src/ledger/invariants';
import { parseBatch } from '../../src/ledger/parse';
import { PADDING_POSTING, leafInputs } from '../../src/ledger/posting';
import { TRUSTED_SOURCE_KEYS } from '../../src/ledger/trusted-keys';
import { batchRoot } from '../../src/zk/batch-root';
import { FieldRangeError } from '../../src/zk/errors';
import { merkleRoot } from '../../src/zk/merkle';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Test samples_verify_and_roots (ledger-format Requirements 5.2, 5.4, 6.4, 8.2, 8.4, example).
//
// For each committed sample: the digest file format, the signature against the trusted demo key,
// the digest root against `batchRoot` and against a root this test builds itself (hashLeaf over
// the 64 padded slots, then merkleRoot), and the invariant results that match the kind. Also the
// FieldRangeError case and the tamper cases of `verifyDigest`.
// Synthetic data only. Failure messages compare booleans, never signatures or batch values.

const SAMPLES_DIR = fileURLToPath(new URL('../../public/samples/', import.meta.url));
const WASM_TIMEOUT_MS = 120_000;

interface SampleCase {
  readonly name: string;
  readonly count: number;
  readonly expected: InvariantResult;
}

const SAMPLES: readonly SampleCase[] = [
  { name: 'clean', count: 12, expected: { balanced: true, withinLimitOrFlagged: true, inRange: true } },
  {
    name: 'over-limit-unflagged',
    count: 12,
    expected: { balanced: true, withinLimitOrFlagged: false, inRange: true },
  },
  { name: 'unbalanced', count: 12, expected: { balanced: false, withinLimitOrFlagged: true, inRange: true } },
  { name: 'large', count: 64, expected: { balanced: true, withinLimitOrFlagged: true, inRange: true } },
];

const DIGEST_KEY_ORDER: readonly string[] = ['batchId', 'merkleRoot', 'recordCount', 'signature', 'sourceKeyId'];

interface DigestFields {
  readonly batchId: string;
  readonly merkleRoot: string;
  readonly recordCount: number;
  readonly signature: string;
  readonly sourceKeyId: string;
}

function readSampleText(name: string): string {
  return readFileSync(join(SAMPLES_DIR, `${name}.dat`), 'latin1');
}

function readDigestText(name: string): string {
  return readFileSync(join(SAMPLES_DIR, `${name}.digest.json`), 'utf8');
}

/** Narrows parsed JSON to the five digest fields. Throws a fixed message and never shows a value. */
function toDigestFields(value: unknown): DigestFields {
  if (typeof value !== 'object' || value === null) throw new Error('TEST DIGEST NOT AN OBJECT');
  const record = value as Record<string, unknown>; // checked to be a non-null object just above
  const { batchId, merkleRoot: root, recordCount, signature, sourceKeyId } = record;
  if (
    typeof batchId !== 'string' ||
    typeof root !== 'string' ||
    typeof recordCount !== 'number' ||
    typeof signature !== 'string' ||
    typeof sourceKeyId !== 'string'
  ) {
    throw new Error('TEST DIGEST FIELD TYPE');
  }
  return { batchId, merkleRoot: root, recordCount, signature, sourceKeyId };
}

function trustedKeyFor(digest: DigestFields): string {
  const key = Object.hasOwn(TRUSTED_SOURCE_KEYS, digest.sourceKeyId) ? TRUSTED_SOURCE_KEYS[digest.sourceKeyId] : undefined;
  if (key === undefined) throw new Error('TEST SOURCE KEY NOT TRUSTED');
  return key;
}

function rootToHex(root: bigint): string {
  return `0x${root.toString(16).padStart(64, '0')}`;
}

describe('samples_verify_and_roots', () => {
  let env: HasherEnv;

  beforeAll(async () => {
    env = await createHasherEnv();
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await env.destroy();
  });

  /** The root built here from the primitives, independent of `batchRoot` and `buildCircuitInputs`. */
  async function ownRoot(postings: ReturnType<typeof parseBatch>['postings']): Promise<bigint> {
    const leaves: bigint[] = [];
    for (let slot = 0; slot < CAPACITY; slot += 1) {
      const posting = postings[slot] ?? PADDING_POSTING;
      leaves.push(await env.hasher.hashLeaf(leafInputs(posting)));
    }
    return merkleRoot(env.hasher, leaves);
  }

  for (const sample of SAMPLES) {
    describe(sample.name, () => {
      it('samples_verify_and_roots: the digest file is JSON.stringify(obj, null, 2) plus LF with the fixed key order and hex forms', () => {
        const text = readDigestText(sample.name);
        const parsed: unknown = JSON.parse(text);
        expect(text === `${JSON.stringify(parsed, null, 2)}\n`).toBe(true);
        expect(Object.keys(parsed as object)).toEqual([...DIGEST_KEY_ORDER]); // parsed is an object, JSON.stringify above accepted it
        const digest = toDigestFields(parsed);
        expect(/^0x[0-9a-f]{64}$/.test(digest.merkleRoot)).toBe(true);
        expect(/^[0-9a-f]{128}$/.test(digest.signature)).toBe(true);
        expect(digest.sourceKeyId.startsWith('DEMO-')).toBe(true);
        expect(/^CTB-[0-9]{8}-[0-9]{3}$/.test(digest.batchId)).toBe(true);
      });

      it('samples_verify_and_roots: the signature verifies against the trusted demo key and recordCount equals the postings', async () => {
        const digest = toDigestFields(JSON.parse(readDigestText(sample.name)));
        const batch = parseBatch(readSampleText(sample.name));
        expect(await verifyDigest(digest, trustedKeyFor(digest))).toBe(true);
        expect(digest.recordCount).toBe(batch.postings.length);
        expect(digest.recordCount).toBe(sample.count);
        expect(digest.batchId).toBe(batch.batchId);
      });

      it(
        'samples_verify_and_roots: the digest root equals batchRoot and the root this test builds itself',
        async () => {
          const digest = toDigestFields(JSON.parse(readDigestText(sample.name)));
          const batch = parseBatch(readSampleText(sample.name));
          const viaBatchRoot = await batchRoot(env.hasher, batch);
          const viaOwnBuild = await ownRoot(batch.postings);
          expect(digest.merkleRoot === rootToHex(viaBatchRoot)).toBe(true);
          expect(digest.merkleRoot === rootToHex(viaOwnBuild)).toBe(true);
          expect(viaBatchRoot === viaOwnBuild).toBe(true);
        },
        WASM_TIMEOUT_MS,
      );

      it('samples_verify_and_roots: the invariant results match the kind', () => {
        const batch = parseBatch(readSampleText(sample.name));
        expect(checkInvariants(batch)).toEqual(sample.expected);
      });

      it('samples_verify_and_roots: a tampered batchId, root or count fails verifyDigest against the trusted key', async () => {
        const digest = toDigestFields(JSON.parse(readDigestText(sample.name)));
        const key = trustedKeyFor(digest);
        expect(await verifyDigest(digest, key)).toBe(true); // control

        const otherId = digest.batchId.endsWith('999') ? 'CTB-20261201-998' : 'CTB-20261201-999';
        expect(await verifyDigest({ ...digest, batchId: otherId }, key)).toBe(false);

        const rootPlusOne = rootToHex(BigInt(digest.merkleRoot) + 1n);
        expect(await verifyDigest({ ...digest, merkleRoot: rootPlusOne }, key)).toBe(false);

        const otherCount = digest.recordCount === CAPACITY ? CAPACITY - 1 : digest.recordCount + 1;
        expect(await verifyDigest({ ...digest, recordCount: otherCount }, key)).toBe(false);
      });
    });
  }

  it(
    'samples_verify_and_roots: an amount of 2^40 makes batchRoot reject with FieldRangeError that holds no value',
    async () => {
      const clean = parseBatch(readSampleText('clean'));
      const first = clean.postings[0];
      if (first === undefined) throw new Error('TEST FIXTURE HAS NO POSTING');
      const batch = { batchId: clean.batchId, postings: [{ ...first, amountCents: AMOUNT_BOUND_CENTS }] };

      let caught: unknown;
      try {
        await batchRoot(env.hasher, batch);
      } catch (error) {
        caught = error;
      }
      expect(caught instanceof FieldRangeError).toBe(true);
      if (!(caught instanceof FieldRangeError)) throw new Error('UNREACHABLE');
      expect(caught.field).toBe('amountCents');
      expect(caught.slot).toBe(0);
      expect(caught.message.includes(AMOUNT_BOUND_CENTS.toString(10))).toBe(false);
    },
    WASM_TIMEOUT_MS,
  );
});
