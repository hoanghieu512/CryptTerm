import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import type { TerminalState } from '../../src/ui/model/types';
import { bundleToJson, decodeBundle } from '../../src/zk/bundle';
import { createVerifier } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { recordingVerifier, signedBundle, testDeps } from '../support/signed-bundle';
import { TINY_BATCH, stateOn } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';
import { STEP_NAMES } from '../support/verify-arbitraries';

// Group 2 tests of Requirement 5.7 (Property 15): any bad input ends in a named rejection. The
// terminal runs the real `createVerifier` with an ephemeral trusted key and a stub proof check.
// Data is synthetic.

const STEP_ROW_FIRST = 9; // row 10, 0-based
const VERDICT_ROW = 16; // row 17

let key: EphemeralKey;
const stub = recordingVerifier('valid');

beforeAll(async () => {
  [key] = (await makeEphemeralKeys(1)) as [EphemeralKey];
});

/** Waits until the run on screen has ended. A hang fails the test after about 10 s. */
async function untilRunEnds(get: () => TerminalState): Promise<TerminalState> {
  for (let i = 0; i < 2000; i += 1) {
    if (get().verify.run === null) return get();
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('TEST: VERIFY RUN DID NOT END');
}

/** Pastes `text` (when not empty), presses Enter on the real verifier and returns the end state. */
async function runWith(text: string): Promise<TerminalState> {
  const deps = testDeps(key, stub.verifyProof);
  const h = makeHarness({
    initial: stateOn('CTM900', TINY_BATCH),
    deps: { verify: createVerifier(deps), trustedKeys: deps.trustedKeys },
  });
  if (text.length > 0) h.terminal.dispatch({ type: 'PASTE_TEXT', text });
  h.terminal.dispatch({ type: 'ENTER' });
  return untilRunEnds(h.terminal.getState);
}

function verdictOf(state: TerminalState): string {
  return (renderGrid(state)[VERDICT_ROW] ?? '').trim();
}

function stepResults(state: TerminalState): string[] {
  const grid = renderGrid(state);
  return STEP_NAMES.map((name, i) => {
    const row = grid[STEP_ROW_FIRST + i] ?? '';
    expect(row.startsWith(name)).toBe(true);
    return row.slice(name.length).trim().split(/\s{2,}/)[0] ?? '';
  });
}

function expectRejectedAt(state: TerminalState, step: number): void {
  expect(verdictOf(state)).toBe(`REJECTED AT ${STEP_NAMES[step]}`);
  const results = stepResults(state);
  results.forEach((result, i) => expect(result).toBe(i < step ? 'OK' : i === step ? 'FAIL' : 'NOT RUN'));
  expect(renderGrid(state).some((row) => row.includes('VERIFIED'))).toBe(false);
  expect(state.status).toBe(MESSAGES.VERIFY_DONE);
}

function validBundle() {
  const [first] = fc.sample(proofBundleArb, { seed: 20264915, numRuns: 1 });
  if (first === undefined) throw new Error('FIXTURE: NO BUNDLE');
  return first;
}

describe('verify_bad_inputs', () => {
  // Feature: verifier, Property 15: Any bad input ends in a named rejection
  // **Validates: Requirements 5.7**
  it('verify_bad_inputs: the empty text ends at FORMAT', async () => {
    expectRejectedAt(await runWith(''), 0);
  });

  it('verify_bad_inputs: random text ends at FORMAT', async () => {
    expectRejectedAt(await runWith('THIS IS NOT A PROOF BUNDLE {"a":1}'), 0);
  });

  it('verify_bad_inputs: a valid bundle cut short ends at FORMAT', async () => {
    const signed = await signedBundle(key, validBundle());
    expectRejectedAt(await runWith(bundleToJson(signed).slice(0, 150)), 0);
  });

  it('verify_bad_inputs: a signed bundle with a wrong circuit_version ends at CIRCUIT', async () => {
    const signed = await signedBundle(key, validBundle());
    const before = stub.calls.length;
    const state = await runWith(bundleToJson({ ...signed, circuitVersion: 'nargo-9.9.9+WRONGVERSION' }));
    expectRejectedAt(state, 4);
    expect(stub.calls.length).toBe(before);
  });

  it('verify_bad_inputs: a 5 MB text ends at FORMAT and the text is not drawn', async () => {
    const state = await runWith('A'.repeat(5 * 1024 * 1024));
    expectRejectedAt(state, 0);
    expect(renderGrid(state).join('\n')).not.toContain('AAAAAAAAAAAAAAAAAAAA');
  });

  it('verify_bad_inputs: the control, a signed bundle with the right circuit, reaches VERIFIED', async () => {
    const signed = await signedBundle(key, validBundle());
    const state = await runWith(bundleToJson(signed));
    expect(verdictOf(state)).toBe('VERIFIED');
    expect(stepResults(state)).toEqual(['OK', 'OK', 'OK', 'OK', 'OK', 'OK']);
  });

  it('verify_bad_inputs: any string that is not a valid bundle encoding ends at FORMAT, never VERIFIED', async () => {
    const notABundle = (text: string): boolean => {
      try {
        decodeBundle(text);
        return false;
      } catch {
        return true;
      }
    };
    await runProperty(
      'verify_bad_inputs',
      { seed: 20264915, numRuns: 200 },
      fc.asyncProperty(
        fc.oneof(fc.string({ maxLength: 300 }), fc.string({ unit: 'binary', maxLength: 300 })).filter(notABundle),
        async (text) => {
          const state = await runWith(text);
          expectRejectedAt(state, 0);
        },
      ),
    );
  });
});
