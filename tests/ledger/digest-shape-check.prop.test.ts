import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { isSignedDigestShape } from '../../src/ledger/digest-shape';
import { runProperty } from '../support/pbt';
import {
  applyMutation,
  digestMutationArb,
  makeEphemeralKeys,
  signTriple,
  sourceKeyIdArb,
  validTripleArb,
} from '../support/digest-arbitraries';
import type { DigestMutation, EphemeralKey } from '../support/digest-arbitraries';

// Feature: zk-core, Property 15: The shape check accepts signed digests and rejects damage.
// Validates: Requirement 3.7. The keys are ephemeral and the check never reads signature bytes.
const SAMPLES_DIR = fileURLToPath(new URL('../../public/samples/', import.meta.url));
const SEED = 20263015;
const NUM_RUNS = 100;

let keys: EphemeralKey[];

beforeAll(async () => {
  keys = await makeEphemeralKeys(2);
});

// Mutations that damage the digest itself. The ones that only change the public key are left out.
const DIGEST_SIDE: ReadonlySet<DigestMutation['kind']> = new Set([
  'dropKey',
  'setKey',
  'extraKey',
  'upperSignature',
  'dropSignatureChar',
  'addSignatureChar',
  'throwingGetter',
  'hostileKey',
  'proxyDigest',
  'wholeDigest',
]);

const damageArb = digestMutationArb.filter((m) => DIGEST_SIDE.has(m.kind));

function keyAt(index: number): EphemeralKey {
  const key = keys[index];
  if (key === undefined) throw new Error('FIXTURE KEY MISSING');
  return key;
}

describe('digest_shape_check accepts', () => {
  it('digest_shape_check: every signed digest is accepted', async () => {
    const draw = fc.tuple(validTripleArb, sourceKeyIdArb);
    const config = { seed: SEED, numRuns: NUM_RUNS };
    await runProperty(
      'P15 digest_shape_check accepts',
      config,
      fc.asyncProperty(draw, async ([triple, id]) => {
        const digest = await signTriple(keyAt(0), triple, id);
        expect(isSignedDigestShape(digest)).toBe(true);
      }),
    );
  });
});

describe('digest_shape_check rejects', () => {
  it('digest_shape_check: every damaged digest is rejected and nothing throws', async () => {
    const draw = fc.tuple(validTripleArb, sourceKeyIdArb, damageArb);
    const config = { seed: SEED + 1, numRuns: NUM_RUNS };
    await runProperty(
      'P15 digest_shape_check rejects',
      config,
      fc.asyncProperty(draw, async ([triple, id, damage]) => {
        const base = await signTriple(keyAt(0), triple, id);
        const damaged = applyMutation(damage, base, keyAt(0).publicKeyHex, keyAt(1).publicKeyHex);
        expect(isSignedDigestShape(damaged.digest)).toBe(false);
      }),
    );
  });
});

describe('digest_shape_check examples', () => {
  it('digest_shape_check: the four committed sample digests are accepted', () => {
    const names = readdirSync(SAMPLES_DIR).filter((n) => n.endsWith('.digest.json'));
    expect(names).toHaveLength(4);
    for (const name of names) {
      const parsed: unknown = JSON.parse(readFileSync(`${SAMPLES_DIR}${name}`, 'utf8'));
      expect(isSignedDigestShape(parsed)).toBe(true);
    }
  });

  it('digest_shape_check: values that are not plain digest objects are rejected', () => {
    const junk: readonly unknown[] = [null, undefined, 0, 'digest', [], [1, 2, 3], () => 1, new Date(0)];
    for (const value of junk) {
      expect(isSignedDigestShape(value)).toBe(false);
    }
  });
});
