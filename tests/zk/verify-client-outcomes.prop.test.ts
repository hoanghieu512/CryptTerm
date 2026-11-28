import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProofOutcome } from '../../src/zk/verifier';
import { VERIFY_TIMEOUT_MS, createProofVerifier } from '../../src/zk/verify-client';
import type { WorkerPort } from '../../src/zk/worker-port';
import type { WorkerFailCode, WorkerRequest } from '../../src/zk/worker-protocol';
import { runProperty } from '../support/pbt';

// Feature: verify-error, Property 1: Proof_Client outcomes are deterministic, exhaustive and sticky
// (verify_client_outcomes). Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1, 3.2, 3.3.
// A fake WorkerPort is driven by random trigger sequences over several concurrent runs. A small model
// says which outcome each run must have and when it settles. Synthetic data only: the proof bytes
// and the public inputs are fixed placeholders.

const OUTCOMES: readonly string[] = ['valid', 'invalid', 'not_completed'];
const PROOF = new Uint8Array([1, 2, 3]);
const INPUTS = ['1', '2', '3'] as const;
const FAIL_CODES: readonly WorkerFailCode[] = ['ASSET_FAILED', 'WITNESS_FAILED', 'PROVER_FAILED'];

interface FakePort extends WorkerPort {
  readonly posted: WorkerRequest[];
  terminated: boolean;
  // Delivers an event to the page handler, as the worker would.
  emit(message: unknown): void;
  // Fires the bare error signal of the port.
  fail(): void;
}

interface Rig {
  readonly ports: FakePort[];
  readonly openPort: () => WorkerPort;
  // When true, the next `post` throws.
  throwOnNextPost: boolean;
}

function makeRig(): Rig {
  const ports: FakePort[] = [];
  const rig: Rig = {
    ports,
    throwOnNextPost: false,
    openPort: () => {
      let onMessage: (message: unknown) => void = () => undefined;
      let onError: () => void = () => undefined;
      const port: FakePort = {
        posted: [],
        terminated: false,
        post(message) {
          if (rig.throwOnNextPost) {
            rig.throwOnNextPost = false;
            throw new Error('FAKE POST FAILURE');
          }
          port.posted.push(message);
        },
        onMessage: (handler) => {
          onMessage = handler;
        },
        onError: (handler) => {
          onError = handler;
        },
        terminate: () => {
          port.terminated = true;
        },
        emit: (message) => onMessage(message),
        fail: () => onError(),
      };
      ports.push(port);
      return port;
    },
  };
  return rig;
}

type Trigger =
  | { readonly kind: 'verified'; readonly run: number; readonly valid: boolean; readonly port: number }
  | { readonly kind: 'failed'; readonly run: number; readonly code: WorkerFailCode; readonly port: number }
  | { readonly kind: 'portError'; readonly port: number }
  | { readonly kind: 'timeout' };

const triggerArb: fc.Arbitrary<Trigger> = fc.oneof(
  fc.record({ kind: fc.constant('verified' as const), run: fc.nat({ max: 7 }), valid: fc.boolean(), port: fc.nat({ max: 7 }) }),
  fc.record({ kind: fc.constant('failed' as const), run: fc.nat({ max: 7 }), code: fc.constantFrom(...FAIL_CODES), port: fc.nat({ max: 7 }) }),
  fc.record({ kind: fc.constant('portError' as const), port: fc.nat({ max: 7 }) }),
  fc.record({ kind: fc.constant('timeout' as const) }),
);

interface Scenario {
  readonly timeoutMs: number;
  readonly postThrows: readonly boolean[];
  readonly triggers: readonly Trigger[];
}

const postThrowArb = fc.oneof({ weight: 4, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) });

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  timeoutMs: fc.integer({ min: 1, max: 5000 }),
  postThrows: fc.array(postThrowArb, { minLength: 1, maxLength: 4 }),
  triggers: fc.array(triggerArb, { maxLength: 12 }),
});

// Lets the resolved promises run their callbacks.
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

// Runs one scenario and checks every run against the model after every step.
async function runScenario(scenario: Scenario): Promise<void> {
  vi.useFakeTimers();
  try {
    const rig = makeRig();
    const verify = createProofVerifier(rig.openPort, scenario.timeoutMs);
    const count = scenario.postThrows.length;
    // What each run resolved with, as the page saw it. `undefined` while the run is pending.
    const seen: unknown[] = new Array<unknown>(count).fill(undefined);
    const expected: (ProofOutcome | undefined)[] = new Array<ProofOutcome | undefined>(count).fill(undefined);
    // How many runs have been started so far. Only those can be pending.
    let started = 0;
    // The index of the port the client holds, or null when it holds none.
    let current: number | null = null;

    const check = (): void => {
      expect(seen).toStrictEqual(expected);
      for (const value of seen) if (value !== undefined) expect(OUTCOMES).toContain(value);
    };
    const settle = (run: number, outcome: ProofOutcome): void => {
      if (expected[run] === undefined) expected[run] = outcome;
    };
    const pendingCount = (): number => expected.slice(0, started).filter((value) => value === undefined).length;
    const settleAll = (): void => {
      for (let i = 0; i < started; i += 1) settle(i, 'not_completed');
    };

    for (let i = 0; i < count; i += 1) {
      rig.throwOnNextPost = scenario.postThrows[i] === true;
      const run = i;
      started += 1;
      void verify(PROOF, INPUTS).then((value) => {
        seen[run] = value;
      });
      if (scenario.postThrows[i] === true) {
        // A post failure drops the port and fails every pending run, this one included.
        settleAll();
        current = null;
      } else if (current === null) {
        current = rig.ports.length - 1;
      }
      await flush();
      check();
    }

    for (const trigger of scenario.triggers) {
      if (trigger.kind === 'timeout') {
        // A timer exists only while a run is pending. If one fires, the port is dropped and every
        // pending run fails.
        const anyPending = pendingCount() > 0;
        vi.advanceTimersByTime(scenario.timeoutMs);
        settleAll();
        if (anyPending) current = null;
      } else {
        const portIndex = rig.ports.length === 0 ? 0 : trigger.port % rig.ports.length;
        const port = rig.ports[portIndex];
        // An event or an error counts only when it comes from the port the client holds.
        const live = current !== null && portIndex === current;
        if (trigger.kind === 'portError') {
          port?.fail();
          if (live) {
            settleAll();
            current = null;
          }
        } else {
          const run = trigger.run % count;
          if (trigger.kind === 'verified') {
            port?.emit({ type: 'verified', runId: run + 1, valid: trigger.valid });
            if (live) settle(run, trigger.valid ? 'valid' : 'invalid');
          } else {
            port?.emit({ type: 'failed', runId: run + 1, code: trigger.code });
            if (live) settle(run, 'not_completed');
          }
        }
      }
      await flush();
      check();
    }

    // Whatever is still pending ends at its timeout. Settled runs keep the value they had.
    const before = [...expected];
    vi.advanceTimersByTime(scenario.timeoutMs);
    settleAll();
    await flush();
    check();
    for (let i = 0; i < count; i += 1) if (before[i] !== undefined) expect(seen[i]).toBe(before[i]);
  } finally {
    vi.useRealTimers();
  }
}

describe('verify_client_outcomes', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('verify_client_outcomes: every run resolves to exactly one of the three outcomes and stays settled', async () => {
    await runProperty('verify-error P1 verify_client_outcomes', { seed: 20265101, numRuns: 200 }, fc.asyncProperty(scenarioArb, runScenario));
  });

  it('verify_client_outcomes: VERIFY_TIMEOUT_MS is 120_000', () => {
    expect(VERIFY_TIMEOUT_MS).toBe(120_000);
  });

  it('verify_client_outcomes: the default timeout is still pending at 119,999 ms and not_completed at 120,000 ms', async () => {
    vi.useFakeTimers();
    try {
      const rig = makeRig();
      const verify = createProofVerifier(rig.openPort);
      let seen: unknown;
      void verify(PROOF, INPUTS).then((value) => {
        seen = value;
      });
      vi.advanceTimersByTime(119_999);
      await flush();
      expect(seen).toBeUndefined();
      vi.advanceTimersByTime(1);
      await flush();
      expect(seen).toBe('not_completed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('verify_client_outcomes: a verified or failed event maps to valid, invalid or not_completed', async () => {
    const rig = makeRig();
    const verify = createProofVerifier(rig.openPort, 1000);
    const first = verify(PROOF, INPUTS);
    const second = verify(PROOF, INPUTS);
    const third = verify(PROOF, INPUTS);
    const port = rig.ports[0] as FakePort;
    port.emit({ type: 'verified', runId: 1, valid: true });
    port.emit({ type: 'verified', runId: 2, valid: false });
    port.emit({ type: 'failed', runId: 3, code: 'ASSET_FAILED' });
    expect([await first, await second, await third]).toStrictEqual(['valid', 'invalid', 'not_completed']);
  });
});
