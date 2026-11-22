import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyDigest } from '../../src/ledger/digest';
import type { SignedDigest } from '../../src/ledger/digest';
import { runProperty } from '../support/pbt';
import {
  flipSignatureBit,
  makeEphemeralKeys,
  rootToHex,
  signTriple,
  sourceKeyIdArb,
  validTripleArb,
} from '../support/digest-arbitraries';
import type { DigestTriple, EphemeralKey } from '../support/digest-arbitraries';

// Feature: ledger-format, Property digest_tamper_detected: For all digests signed with an ephemeral key, verifyDigest is true for the original and false after any change to batchId, root, count or signature
// **Validates: Requirements 6.5**
//
// Seed 20262009, 200 runs. The keys are EPHEMERAL: made here with `crypto.subtle.generateKey`
// and thrown away with the test process. The Demo_Key is never read and nothing is imported
// from `scripts/`. A few keys are made once per file and reused, and every run signs afresh in
// the test code (signing in tests is allowed, signing in `src/` is not).
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262009;
const NUM_RUNS = 200;
const KEY_COUNT = 3;
const SIGNATURE_BITS = 512;

let keys: EphemeralKey[] = [];

beforeAll(async () => {
  keys = await makeEphemeralKeys(KEY_COUNT);
});

function keyAt(index: number): EphemeralKey {
  const key = keys[index % KEY_COUNT];
  if (key === undefined) throw new Error('FIXTURE KEYS NOT READY');
  return key;
}

/** Two valid triples that differ in all three fields, so each change below is a real change. */
const originalAndOtherArb: fc.Arbitrary<readonly [DigestTriple, DigestTriple]> = fc
  .tuple(validTripleArb, validTripleArb)
  .filter(
    ([a, b]) => a.batchId !== b.batchId && a.merkleRoot !== b.merkleRoot && a.recordCount !== b.recordCount,
  );

describe('digest_tamper_detected', () => {
  it('digest_tamper_detected: the signed digest verifies, and any change to batchId, root, count or signature does not', async () => {
    await runProperty(
      'ledger-format digest_tamper_detected',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.asyncProperty(
        originalAndOtherArb,
        sourceKeyIdArb,
        fc.nat({ max: KEY_COUNT - 1 }),
        fc.nat({ max: SIGNATURE_BITS - 1 }),
        async ([original, other], sourceKeyId, keyIndex, bitIndex) => {
          const key = keyAt(keyIndex);
          const digest = await signTriple(key, original, sourceKeyId);

          // Shape of the fixture: 0x + 64 lowercase hex, 128 lowercase hex, DEMO- + 16 lowercase hex.
          expect(digest.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
          expect(digest.signature).toMatch(/^[0-9a-f]{128}$/);
          expect(digest.sourceKeyId).toMatch(/^DEMO-[0-9a-f]{16}$/);
          expect(key.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

          // The original verifies.
          expect(await verifyDigest(digest, key.publicKeyHex)).toBe(true);

          // A changed batchId, root or count, with the old signature.
          const changedBatchId: SignedDigest = { ...digest, batchId: other.batchId };
          const changedRoot: SignedDigest = { ...digest, merkleRoot: rootToHex(other.merkleRoot) };
          const changedCount: SignedDigest = { ...digest, recordCount: other.recordCount };
          expect(await verifyDigest(changedBatchId, key.publicKeyHex)).toBe(false);
          expect(await verifyDigest(changedRoot, key.publicKeyHex)).toBe(false);
          expect(await verifyDigest(changedCount, key.publicKeyHex)).toBe(false);

          // One flipped signature bit.
          const flipped: SignedDigest = { ...digest, signature: flipSignatureBit(digest.signature, bitIndex) };
          expect(flipped.signature).not.toBe(digest.signature);
          expect(await verifyDigest(flipped, key.publicKeyHex)).toBe(false);

          // The original digest checked against a different ephemeral public key.
          const otherKey = keyAt(keyIndex + 1);
          expect(otherKey.publicKeyHex).not.toBe(key.publicKeyHex);
          expect(await verifyDigest(digest, otherKey.publicKeyHex)).toBe(false);
        },
      ),
    );
  });

  it('digest_tamper_detected: a digest re-signed over the changed fields verifies, so only the signature binds them', async () => {
    // Control for the property above: the `false` results come from the changed field, not from
    // a fixture that never verifies. The same key signs the changed triple and it verifies.
    const key = keyAt(0);
    const original: DigestTriple = { batchId: 'CTB-20261201-001', merkleRoot: 123456789n, recordCount: 12 };
    const changed: DigestTriple = { batchId: 'CTB-20261201-002', merkleRoot: 123456790n, recordCount: 13 };
    const digestOriginal = await signTriple(key, original, 'DEMO-0123456789abcdef');
    const digestChanged = await signTriple(key, changed, 'DEMO-0123456789abcdef');
    expect(await verifyDigest(digestOriginal, key.publicKeyHex)).toBe(true);
    expect(await verifyDigest(digestChanged, key.publicKeyHex)).toBe(true);
    expect(digestOriginal.signature).not.toBe(digestChanged.signature);
    // Ed25519 signing is deterministic: the same key and message give the same signature.
    expect((await signTriple(key, original, 'DEMO-0123456789abcdef')).signature).toBe(digestOriginal.signature);
    // Moving the one field's worth of change across digests breaks verification.
    expect(await verifyDigest({ ...digestOriginal, signature: digestChanged.signature }, key.publicKeyHex)).toBe(false);
  });
});
