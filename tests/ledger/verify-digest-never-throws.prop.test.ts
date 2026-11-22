import fc from 'fast-check';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyDigest } from '../../src/ledger/digest';
import { runProperty } from '../support/pbt';
import {
  DIGEST_KEYS,
  applyMutation,
  digestMutationArb,
  digestWithThrowingGetters,
  hostileValue,
  makeEphemeralKeys,
  signTriple,
  sourceKeyIdArb,
  throwingProxy,
  validTripleArb,
} from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';

// Feature: ledger-format, Property verify_digest_never_throws: For all arbitrary inputs, verifyDigest resolves a boolean and never throws or rejects
// **Validates: Requirements 6.6**
//
// Seed 20262010, 300 runs. Junk is anything fast-check can build, plus a well-formed signed digest
// with exactly one damage: a missing or retyped key, malformed hex, a wrong length, a root at or
// above FIELD_MODULUS, a count out of range, an extra key, a bad or wrong public key, objects
// whose getters throw, and Proxies that throw on every trap. For every one of them
// `verifyDigest` must return a Promise that resolves to `false`. The undamaged pair is the
// control and must resolve to `true`.
//
// Keys are EPHEMERAL (made here, never the Demo_Key). Data is synthetic. Nothing is printed
// except the seed line from `runProperty`.

const SEED = 20262010;
const NUM_RUNS = 300;
const KEY_COUNT = 3;

let keys: EphemeralKey[] = [];

beforeAll(async () => {
  keys = await makeEphemeralKeys(KEY_COUNT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function keyAt(index: number): EphemeralKey {
  const key = keys[index % KEY_COUNT];
  if (key === undefined) throw new Error('FIXTURE KEYS NOT READY');
  return key;
}

/** Calls `verifyDigest` and asserts: returns a Promise, does not throw, resolves, resolves false. */
async function expectResolvesFalse(digest: unknown, publicKeyHex: unknown): Promise<void> {
  const pending = verifyDigest(digest, publicKeyHex);
  expect(pending).toBeInstanceOf(Promise);
  const result: unknown = await pending;
  expect(result).toBe(false);
}

describe('verify_digest_never_throws', () => {
  it('verify_digest_never_throws: arbitrary values for both arguments resolve false', async () => {
    await runProperty(
      'ledger-format verify_digest_never_throws anything',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.asyncProperty(fc.anything(), fc.anything(), async (digest, publicKeyHex) => {
        await expectResolvesFalse(digest, publicKeyHex);
      }),
    );
  });

  it('verify_digest_never_throws: arbitrary values as digest with a real public key resolve false', async () => {
    await runProperty(
      'ledger-format verify_digest_never_throws anything with key',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.asyncProperty(fc.anything(), fc.nat({ max: KEY_COUNT - 1 }), async (digest, keyIndex) => {
        await expectResolvesFalse(digest, keyAt(keyIndex).publicKeyHex);
      }),
    );
  });

  it('verify_digest_never_throws: a signed digest with one damage resolves false, the undamaged one resolves true', async () => {
    await runProperty(
      'ledger-format verify_digest_never_throws damaged digest',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.asyncProperty(
        validTripleArb,
        sourceKeyIdArb,
        fc.nat({ max: KEY_COUNT - 1 }),
        digestMutationArb,
        async (triple, sourceKeyId, keyIndex, mutation) => {
          const key = keyAt(keyIndex);
          const base = await signTriple(key, triple, sourceKeyId);
          // Control: the undamaged pair verifies, so every `false` below comes from the damage.
          expect(await verifyDigest(base, key.publicKeyHex)).toBe(true);
          const { digest, publicKeyHex } = applyMutation(mutation, base, key.publicKeyHex, keyAt(keyIndex + 1).publicKeyHex);
          await expectResolvesFalse(digest, publicKeyHex);
        },
      ),
    );
  });

  it('verify_digest_never_throws: missing arguments, hostile objects and throwing getters resolve false', async () => {
    const key = keyAt(0);
    const base = await signTriple(
      key,
      { batchId: 'CTB-20261201-001', merkleRoot: 42n, recordCount: 3 },
      'DEMO-0123456789abcdef',
    );
    expect(await verifyDigest(base, key.publicKeyHex)).toBe(true);
    // Called with fewer arguments than the signature has, as untyped callers do.
    const untyped = verifyDigest as (...args: unknown[]) => Promise<boolean>;
    await expect(untyped()).resolves.toBe(false);
    await expect(untyped(base)).resolves.toBe(false);
    await expect(untyped(undefined, key.publicKeyHex)).resolves.toBe(false);
    // Hostile digest objects.
    await expectResolvesFalse(throwingProxy(), key.publicKeyHex);
    await expectResolvesFalse(digestWithThrowingGetters(base, DIGEST_KEYS), key.publicKeyHex);
    for (const name of DIGEST_KEYS) {
      await expectResolvesFalse(digestWithThrowingGetters(base, [name]), key.publicKeyHex);
    }
    // Hostile public keys.
    await expectResolvesFalse(base, hostileValue());
    await expectResolvesFalse(base, throwingProxy());
    // Digest passed as its own public key, and the public key as the digest.
    await expectResolvesFalse(base, base);
    await expectResolvesFalse(key.publicKeyHex, base);
    // A cyclic object.
    const cyclic: Record<string, unknown> = { ...base };
    cyclic.self = cyclic;
    await expectResolvesFalse(cyclic, key.publicKeyHex);
  });

  it('verify_digest_never_throws: a well-shaped but unusable public key still resolves false', async () => {
    const key = keyAt(0);
    const base = await signTriple(
      key,
      { batchId: 'CTB-20261201-001', merkleRoot: 42n, recordCount: 3 },
      'DEMO-0123456789abcdef',
    );
    // 64 lowercase hex characters, so the shape check passes and `crypto.subtle.importKey` or
    // `verify` is reached with key bytes that are not the signer's key.
    const unusable: readonly string[] = [
      '0'.repeat(64),
      'f'.repeat(64),
      `01${'0'.repeat(62)}`,
      `${'f'.repeat(62)}7f`,
      `ecff${'f'.repeat(58)}7f`,
      `${'0'.repeat(62)}80`,
    ];
    for (const publicKeyHex of unusable) {
      await expectResolvesFalse(base, publicKeyHex);
    }
  });

  it('verify_digest_never_throws: when crypto.subtle.importKey or verify rejects or throws, the result is false', async () => {
    const key = keyAt(0);
    const base = await signTriple(
      key,
      { batchId: 'CTB-20261201-001', merkleRoot: 42n, recordCount: 3 },
      'DEMO-0123456789abcdef',
    );
    expect(await verifyDigest(base, key.publicKeyHex)).toBe(true);
    const subtle = globalThis.crypto.subtle;

    // A platform without Ed25519: `importKey` rejects.
    const importRejects = vi.spyOn(subtle, 'importKey').mockRejectedValue(new Error('NOT SUPPORTED'));
    await expectResolvesFalse(base, key.publicKeyHex);
    expect(importRejects).toHaveBeenCalled();
    importRejects.mockRestore();

    // `importKey` throws before it returns a promise.
    const importThrows = vi.spyOn(subtle, 'importKey').mockImplementation(() => {
      throw new Error('NOT SUPPORTED');
    });
    await expectResolvesFalse(base, key.publicKeyHex);
    expect(importThrows).toHaveBeenCalled();
    importThrows.mockRestore();

    // `verify` rejects after a good import.
    const verifyRejects = vi.spyOn(subtle, 'verify').mockRejectedValue(new Error('NOT SUPPORTED'));
    await expectResolvesFalse(base, key.publicKeyHex);
    expect(verifyRejects).toHaveBeenCalled();
    verifyRejects.mockRestore();

    // With the platform back to normal, the same pair verifies.
    expect(await verifyDigest(base, key.publicKeyHex)).toBe(true);
  });
});
