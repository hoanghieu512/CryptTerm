import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkBatch } from '../../src/ledger/check-batch';
import type { CheckReason, CheckResult } from '../../src/ledger/check-batch';
import { buildCircuitInputs } from '../../src/zk/witness-builder';
import { runProperty } from '../support/pbt';
import { checkCaseArb } from '../support/check-batch-arbitraries';
import type { CheckCase } from '../support/check-batch-arbitraries';
import { createHasherEnv, createNoirEnv } from '../support/zk-env';
import type { HasherEnv, NoirEnv } from '../support/zk-env';

// Feature: zk-core, Property 1: Pre-check agrees with the circuit
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
//
// For each generated case the circuit side is: build the inputs with `buildCircuitInputs`, then
// `noir.execute`. The case succeeds when both return. `checkBatch` must return ok exactly then.
// When it does not, the reason must match the stage that failed, in the circuit's own order:
//   OUT_OF_RANG//   OUT_OF_RANG//   OUT_OFew//   OUT_OF_RANG//   OUT_OF_RANG//   OUT_OFew//   OUT_OF_RANG//   EB//   OUT_OF_RANG//   OUT_OF_RANG//   OUT_OFew//   OUT_execu//   OUT_OF_RANG//   OUT_OF_RANG//   OUT_OFew//   OUT_OF_RANGy: no SRS, no proof. All values are synthetic and nothing is printed ex//   OUT_OF_RANG//   OUT_OF_RANG//   OUT_OFe o//   OU of outcome counts.

const NUM_RUNS = 100;
const SEED = 20263001;
const PROPERTY_TIMEOUT_MS = 120_000;
const WASM_TIMEOUT_MS = 120_000;

let hasherEnv: HasherEnv;
let noirEnv: NoirEnv;

beforeAll(async () => {
  hasherEnv = await createHasherEnv();
  noirEnv = createNoirEnv();
}, WASM_TIMEOUT_MS);

afterAll(async () => {
  await hasherEnv.destroy();
});

type Outcome = 'OK' | CheckReason | 'OTHER';

// Assertion text of the circuit for each reason, from constraints 9 and 10 in main.nr.
const CIRCUIT_TEXT: ReadonlyArray<readonly [string, Outcome]> = [
  ['DEBITS NOT EQUAL TO CREDITS', 'UNBALANCED'],
  ['OVER LIMIT WITHOUT REVIEW FLAG', 'OVER_LIMIT_UNFLAGGED'],
];

function classify(message: string): Outcome {
  const hit = CIRCUIT_TEXT.find(([text]) => message.includes(text));
  return hit === undefined ? 'OTHER' : hit[1];
}

/** What the builder plus the circuit do with a case. Never throws. */
async function circuitOutcome(c: CheckCase): Promise<Outcome> {
  let inputs;
  try {
    const built = await buildCircuitInputs(hasherEnv.hasher, {
      postings: c.batch.postings,
      limitCents: c.limitCents,
    });
    inputs = built.inputs;
  } catch {
    return 'OUT_OF_RANGE';
  }
  try {
    await noirEnv.noir.execute(inputs);
    return 'OK';
  } catch (error) {
    return classify(error instanceof Error ? error.message : '');
  }
}

function outcomeOf(result: CheckResult): Outcome {
  return result.ok ? 'OK' : result.reason;
}

async function checkOneCase(c: CheckCase, tally: Map<Outcome, number>): Promise<void> {
  const result = checkBatch(c.batch, c.limitCents);
  // The result holds a verdict and a code only, never a posting value.
  expect(Object.keys(result).sort()).toEqual(result.ok ? ['ok'] : ['ok', 'reason']);
  const circuit = await circuitOutcome(c);
  expect(circuit).not.toBe('OTHER');
  expect(outcomeOf(result)).toBe(circuit);
  tally.set(circuit, (tally.get(circuit) ?? 0) + 1);
}

describe('checkBatch_matches_circuit', () => {
  it(
    'checkBatch_matches_circuit: ok exactly when builder plus circuit succeed, with the same reason',
    async () => {
      const tally = new Map<Outcome, number>();
      const config = { seed: SEED, numRuns: NUM_RUNS };
      await runProperty(
        'P1 checkBatch_matches_circuit',
        config,
        fc.asyncProperty(checkCaseArb, (c) => checkOneCase(c, tally)),
      );
      // Counts only. Every outcome must occur, so the property is not vacuous.
      const line = [...tally.entries()].map(([k, v]) => `${k}=${v}`).join(' ');
      process.stdout.write(`PBT P1 outcomes: ${line}\n`);
      for (const outcome of ['OK', 'OUT_OF_RANGE', 'UNBALANCED', 'OVER_LIMIT_UNFLAGGED'] as const) {
        expect(tally.get(outcome) ?? 0).toBeGreaterThan(0);
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
