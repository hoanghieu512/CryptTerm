import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS, CAPACITY } from '../../src/zk/field';
import { PADDING_POSTING } from '../../src/zk/posting';
import type { Posting } from '../../src/zk/posting';
import { assembleCircuitInputs, buildCircuitInputs } from '../../src/zk/witness-builder';
import { PROPERTY_SEEDS, runProperty } from '../support/pbt';
import {
  applyOneCentChange,
  expandToSlots,
  oneCentChanges,
  witnessWithOneCentChangeArb,
} from '../support/zk-arbitraries';
import type { OneCentChange, ValidWitness } from '../support/zk-arbitraries';
import { createHasherEnv, createNoirEnv } from '../support/zk-env';
import type { HasherEnv, NoirEnv } from '../support/zk-env';

// Property 2 (Requirements 6.3, 6.7, 4.1, 4.3, 4.5, 4.10).
//
// For a valid witness, the original inputs are built by the real Witness_Builder, so the public
// `merkle_root` is the root of the UNCHANGED 64 slots. Then exactly one slot's amount moves by one
// cent (+1 or -1) and the inputs are assembled again with `rootOverride` = the ORIGINAL root. The
// root is never recomputed from the changed slots. `assembleCircuitInputs` still range-validates
// every slot (the draw keeps the new amount within 0 to 2^40 - 1), so the circuit sees an
// in-range amount and must reject for its own reasons.
//
// Which assertion fires first follows the order in `circuits/ledger_audit/src/main.nr`:
//   constraint 7 (padding neutral) runs in the per-slot loop BEFORE constraint 8 (root) and 9 (balance).
//   - a REAL slot (index < record_count) changed by one cent: slot checks 4 to 7 pass (the amount
//     is in range and a real slot may hold any amount), then the recomputed root differs from the
//     original: `MERKLE ROOT MISMATCH`.
//   - a PADDING slot (index >= record_count) changed by +1 cent: `PADDING SLOT NOT NEUTRAL`.
//     A padding slot has amount 0, so -1 is never drawn for it.
//
// Each run also executes the UNCHANGED inputs first (control): it must not throw, so a rejection of
// the changed inputs cannot come from a broken witness.
//
// All values are synthetic. Nothing is printed except the seed line from `runProperty` and one
// line of two message counts (not batch data).

// ---------------------------------------------------------------------------
// Timing constants (one place)
// ---------------------------------------------------------------------------

const NUM_RUNS = 100;

/**
 * Per-test timeout for the property: `max(60 s, 5 x NUM_RUNS x (T_BUILD_MS + T_EXEC_MS))`.
 * Measured in task 6.12 (Property 1 seed, 100 witnesses): T_build mean 9.04 ms, T_exec mean
 * 50.64 ms (p95 63.18 ms). Per run this test does one extra execute (the control), so the formula
 * uses T_build + 2 x T_exec = 110.32 ms: 5 x 100 x 110.32 ms = 55.2 s, below the 60 s floor, so the
 * timeout is 60 s (the property itself runs in about 9 s).
 */
const PROPERTY_TIMEOUT_MS = 60_000;
const WASM_TIMEOUT_MS = 120_000;
const EXAMPLE_TIMEOUT_MS = 60_000;

const PROPERTY_CONFIG = { seed: PROPERTY_SEEDS.P2, numRuns: NUM_RUNS } as const;

const MERKLE_ROOT_MISMATCH = 'MERKLE ROOT MISMATCH';
const PADDING_SLOT_NOT_NEUTRAL = 'PADDING SLOT NOT NEUTRAL';

let hasherEnv: HasherEnv;
let noirEnv: NoirEnv;

beforeAll(async () => {
  hasherEnv = await createHasherEnv();
  noirEnv = createNoirEnv();
}, WASM_TIMEOUT_MS);

afterAll(async () => {
  await hasherEnv.destroy();
});

/** Message of the error that `execute` throws, or `undefined` if it did not throw. */
async function executeMessage(inputs: Parameters<NoirEnv['noir']['execute']>[0]): Promise<string | undefined> {
  try {
    await noirEnv.noir.execute(inputs);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'NON-ERROR THROWN';
  }
}

/** The assertion text that must fail first for a change, from the constraint order in `main.nr`. */
function expectedMessage(witness: ValidWitness, change: OneCentChange): string {
  return change.slot < witness.recordCount ? MERKLE_ROOT_MISMATCH : PADDING_SLOT_NOT_NEUTRAL;
}

/**
 * Builds the original inputs and the changed inputs (original root kept). Returns both maps.
 * The changed map is built from `applyOneCentChange` and `assembleCircuitInputs` with `rootOverride`.
 */
async function buildPair(witness: ValidWitness, change: OneCentChange) {
  const original = await buildCircuitInputs(hasherEnv.hasher, {
    postings: witness.postings,
    limitCents: witness.limitCents,
  });
  const changedSlots = applyOneCentChange(expandToSlots(witness), change);
  const changed = await assembleCircuitInputs(
    hasherEnv.hasher,
    changedSlots,
    witness.recordCount,
    witness.limitCents,
    original.merkleRoot,
  );
  return { original, changed, changedSlots };
}

/** Number of slots whose amount differs between two 64-slot arrays. */
function differingAmounts(a: readonly Posting[], b: readonly Posting[]): number {
  return a.filter((p, i) => p.amountCents !== b[i]?.amountCents).length;
}

// Feature: zk-spike, Property 2: Changing one amount by one cent is rejected
// **Validates: Requirements 6.3, 4.1, 4.3, 4.5, 4.10**
describe('Property 2: Changing one amount by one cent is rejected', () => {
  it(
    'noir.execute rejects one changed amount with the original merkle_root, and accepts the original',
    async () => {
      const tally = { rootMismatch: 0, paddingNotNeutral: 0 };
      await runProperty(
        'P2 one-cent-change',
        PROPERTY_CONFIG,
        fc.asyncProperty(witnessWithOneCentChangeArb, async ({ witness, change }) => {
          const { original, changed, changedSlots } = await buildPair(witness, change);

          // Exactly one slot differs, by exactly one cent, and the root is the original one.
          expect(differingAmounts(expandToSlots(witness), changedSlots)).toBe(1);
          expect(changed.merkleRoot).toBe(original.merkleRoot);
          expect(changed.inputs.merkle_root).toBe(original.inputs.merkle_root);

          // Control: the unchanged witness is accepted (throws and fails the property otherwise).
          await noirEnv.noir.execute(original.inputs);

          // The changed inputs must be rejected, with the assertion for the slot kind.
          const message = await executeMessage(changed.inputs);
          expect(message).toBeDefined();
          const expected = expectedMessage(witness, change);
          expect(message).toContain(expected);
          if (expected === MERKLE_ROOT_MISMATCH) tally.rootMismatch += 1;
          else tally.paddingNotNeutral += 1;
        }),
      );
      // Counts only, no batch data. Includes shrink replays if the property ever fails.
      process.stdout.write(
        `PBT P2 one-cent-change messages: ${MERKLE_ROOT_MISMATCH}=${tally.rootMismatch} ${PADDING_SLOT_NOT_NEUTRAL}=${tally.paddingNotNeutral}\n`,
      );
      expect(tally.rootMismatch + tally.paddingNotNeutral).toBe(NUM_RUNS);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

// ---------------------------------------------------------------------------
// Non-vacuity: hand-picked witnesses
// ---------------------------------------------------------------------------

const MAX_CENTS = AMOUNT_BOUND_CENTS - 1n;

function twoPostings(amountCents: bigint): readonly Posting[] {
  return [
    { recordId: 100001n, account: 100000000001n, side: 0n, amountCents, reviewFlag: 0n, salt: 900001n },
    { recordId: 100002n, account: 100000000002n, side: 1n, amountCents, reviewFlag: 0n, salt: 900002n },
  ];
}

function witnessOf(postings: readonly Posting[], limitCents: bigint): ValidWitness {
  return { postings, limitCents, recordCount: postings.length };
}

describe('Property 2 non-vacuity: hand-picked witnesses', () => {
  it(
    '+1 and -1 on slot 0 of a balanced debit and credit are both rejected with MERKLE ROOT MISMATCH',
    async () => {
      const witness = witnessOf(twoPostings(100_000n), 1_000_000n);
      // The control inside buildPair's caller: the original is accepted.
      const first = await buildPair(witness, { slot: 0, delta: 1n });
      await expect(noirEnv.noir.execute(first.original.inputs)).resolves.toBeDefined();
      for (const delta of [1n, -1n] as const) {
        const { original, changed, changedSlots } = await buildPair(witness, { slot: 0, delta });
        expect(changed.merkleRoot).toBe(original.merkleRoot);
        expect(changedSlots[0]?.amountCents).toBe(100_000n + delta);
        expect(await executeMessage(changed.inputs)).toContain(MERKLE_ROOT_MISMATCH);
      }
    },
    EXAMPLE_TIMEOUT_MS,
  );

  it(
    'a +1 on the first padding slot is rejected with PADDING SLOT NOT NEUTRAL',
    async () => {
      const witness = witnessOf(twoPostings(100_000n), 1_000_000n);
      const { changed } = await buildPair(witness, { slot: 2, delta: 1n });
      expect(await executeMessage(changed.inputs)).toContain(PADDING_SLOT_NOT_NEUTRAL);
    },
    EXAMPLE_TIMEOUT_MS,
  );

  it('never offers an out-of-range pair at the amount boundaries', () => {
    // Amount 2^40 - 1 on slots 0 and 1: +1 is excluded there, -1 is offered.
    const high = witnessOf(twoPostings(MAX_CENTS), MAX_CENTS);
    const highChanges = oneCentChanges(high);
    expect(highChanges).not.toContainEqual({ slot: 0, delta: 1n });
    expect(highChanges).not.toContainEqual({ slot: 1, delta: 1n });
    expect(highChanges).toContainEqual({ slot: 0, delta: -1n });
    expect(highChanges).toContainEqual({ slot: 1, delta: -1n });

    // Amount 0 on slots 0 and 1: -1 is excluded everywhere (padding slots are 0 too), +1 is offered.
    const low = witnessOf(twoPostings(0n), 1n);
    const lowChanges = oneCentChanges(low);
    expect(lowChanges.some((c) => c.delta === -1n)).toBe(false);
    expect(lowChanges).toHaveLength(CAPACITY);

    // Every offered pair keeps the new amount within 0 to 2^40 - 1.
    for (const w of [high, low]) {
      const slots = expandToSlots(w);
      for (const change of oneCentChanges(w)) {
        const base = slots[change.slot]?.amountCents;
        if (base === undefined) throw new Error('SLOT OUT OF RANGE');
        const next = base + change.delta;
        expect(next >= 0n && next < AMOUNT_BOUND_CENTS).toBe(true);
        expect(applyOneCentChange(slots, change)[change.slot]?.amountCents).toBe(next);
      }
    }
    expect(PADDING_POSTING.amountCents).toBe(0n);
  });

  it(
    'the boundary change 2^40 - 1 to 2^40 - 2 is rejected, and the original is accepted',
    async () => {
      const witness = witnessOf(twoPostings(MAX_CENTS), MAX_CENTS);
      const { original, changed } = await buildPair(witness, { slot: 0, delta: -1n });
      await expect(noirEnv.noir.execute(original.inputs)).resolves.toBeDefined();
      expect(await executeMessage(changed.inputs)).toContain(MERKLE_ROOT_MISMATCH);
    },
    EXAMPLE_TIMEOUT_MS,
  );
});
