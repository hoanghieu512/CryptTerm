import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hasher, LeafFields } from '../../src/zk/hash';
import type { Posting } from '../../src/zk/posting';
import { buildCircuitInputs } from '../../src/zk/witness-builder';
import { PROPERTY_SEEDS, runProperty } from '../support/pbt';
import { validWitnessArb } from '../support/zk-arbitraries';
import { createHasherEnv, createNoirEnv } from '../support/zk-env';
import type { HasherEnv, NoirEnv } from '../support/zk-env';

// Property 1 (Requirements 3.8, 6.2, 6.7) and a negative control for the leaf field order.
//
// The inputs come from the real Witness_Builder (`buildCircuitInputs` with the real hasher), so
// the leaf field order, leaf hash and Merkle root are the TypeScript side's own. `noir.execute`
// runs on the committed Artifact (`src/zk/artifacts/ledger_audit.json`). The circuit recomputes
// the root from the private postings with `leaf_fields()`, and asserts it equals `merkle_root`
// (`MERKLE ROOT MISMATCH`). So a leaf field order mismatch between TypeScript and the circuit
// makes `execute` throw and the property fail. No `nargo` test pins that order.
//
// All values are synthetic. Nothing is printed except the seed line from `runProperty`.

// ---------------------------------------------------------------------------
// Timing constants (one place)
// ---------------------------------------------------------------------------

const NUM_RUNS = 100;

/**
 * Per-test timeout for the property: `max(60 s, 5 x NUM_RUNS x (T_BUILD_MS + T_EXEC_MS))`.
 * Measured in task 6.12 over 100 witnesses with this seed: T_build mean 9.04 ms, T_exec mean
 * 50.64 ms (p95 63.18 ms, max 163.53 ms), combined mean 59.68 ms. So 5 x 100 x 59.68 ms = 29.8 s,
 * below the 60 s floor, and the timeout is 60 s (the property itself runs in about 6 s).
 */
const PROPERTY_TIMEOUT_MS = 60_000;
const WASM_TIMEOUT_MS = 120_000;
const CONTROL_TIMEOUT_MS = 60_000;

const PROPERTY_CONFIG = { seed: PROPERTY_SEEDS.P1, numRuns: NUM_RUNS } as const;

const MERKLE_ROOT_MISMATCH = 'MERKLE ROOT MISMATCH';

let hasherEnv: HasherEnv;
let noirEnv: NoirEnv;

beforeAll(async () => {
  hasherEnv = await createHasherEnv();
  noirEnv = createNoirEnv();
}, WASM_TIMEOUT_MS);

afterAll(async () => {
  await hasherEnv.destroy();
});

// Feature: zk-spike, Property 1: Witness_Builder root is accepted by the circuit
// **Validates: Requirements 3.8, 6.2**
describe('Property 1: Witness_Builder root is accepted by the circuit', () => {
  it(
    'noir.execute accepts the Witness_Builder inputs for every valid witness',
    async () => {
      await runProperty(
        'P1 root-parity',
        PROPERTY_CONFIG,
        fc.asyncProperty(validWitnessArb, async (witness) => {
          const built = await buildCircuitInputs(hasherEnv.hasher, {
            postings: witness.postings,
            limitCents: witness.limitCents,
          });
          // Throws (and fails the property) if the circuit rejects any constraint, including
          // `MERKLE ROOT MISMATCH`. Execution only, no proving.
          await noirEnv.noir.execute(built.inputs);
        }),
      );
    },
    PROPERTY_TIMEOUT_MS,
  );
});

// ---------------------------------------------------------------------------
// Negative control: a TypeScript-side leaf field order mismatch is caught
// ---------------------------------------------------------------------------

/** A hasher that permutes the six leaf fields before hashing. Test-only, never in `src`. */
function deflectedHasher(real: Hasher, permute: (f: LeafFields) => LeafFields): Hasher {
  return {
    hashLeaf: (fields) => real.hashLeaf(permute(fields)),
    hashNode: (left, right) => real.hashNode(left, right),
  };
}

// Leaf order: [recordId, account, side, amount, reviewFlag, salt].
const identity = (f: LeafFields): LeafFields => f;
const swapSideAndFlag = ([id, acc, side, amt, flag, salt]: LeafFields): LeafFields => [
  id,
  acc,
  flag,
  amt,
  side,
  salt,
];
const swapIdAndAccount = ([id, acc, side, amt, flag, salt]: LeafFields): LeafFields => [
  acc,
  id,
  side,
  amt,
  flag,
  salt,
];
const rotateByOne = ([id, acc, side, amt, flag, salt]: LeafFields): LeafFields => [
  acc,
  side,
  amt,
  flag,
  salt,
  id,
];

/**
 * Fixed valid witness: balanced (100000 = 60000 + 40000), under the limit. Every swap below changes
 * at least one real leaf: posting 2 has side 1 and flag 0, ids and accounts differ everywhere.
 */
const CONTROL_POSTINGS: readonly Posting[] = [
  { recordId: 100001n, account: 100000000001n, side: 0n, amountCents: 100000n, reviewFlag: 0n, salt: 900001n },
  { recordId: 100002n, account: 100000000002n, side: 1n, amountCents: 60000n, reviewFlag: 0n, salt: 900002n },
  { recordId: 100003n, account: 100000000003n, side: 1n, amountCents: 40000n, reviewFlag: 1n, salt: 900003n },
];
const CONTROL_LIMIT_CENTS = 1_000_000n;

describe('Property 1 negative control: leaf field order mismatch is caught by the circuit', () => {
  const controlInput = { postings: CONTROL_POSTINGS, limitCents: CONTROL_LIMIT_CENTS };

  it(
    'the identity permutation is accepted (the wrapper itself is sound)',
    async () => {
      const built = await buildCircuitInputs(deflectedHasher(hasherEnv.hasher, identity), controlInput);
      await expect(noirEnv.noir.execute(built.inputs)).resolves.toBeDefined();
    },
    CONTROL_TIMEOUT_MS,
  );

  const cases: ReadonlyArray<readonly [string, (f: LeafFields) => LeafFields]> = [
    ['swap side and reviewFlag', swapSideAndFlag],
    ['swap recordId and account', swapIdAndAccount],
    ['rotate the six fields by one', rotateByOne],
  ];

  it.each(cases)(
    'execute throws MERKLE ROOT MISMATCH for: %s',
    async (_label, permute) => {
      const real = await buildCircuitInputs(hasherEnv.hasher, controlInput);
      const deflected = await buildCircuitInputs(deflectedHasher(hasherEnv.hasher, permute), controlInput);
      // The permutation must really change the root, or the control proves nothing.
      expect(deflected.merkleRoot).not.toBe(real.merkleRoot);
      await expect(noirEnv.noir.execute(deflected.inputs)).rejects.toThrow(MERKLE_ROOT_MISMATCH);
    },
    CONTROL_TIMEOUT_MS,
  );
});
