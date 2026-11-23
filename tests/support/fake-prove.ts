// Fake ProveService for the terminal-ui tests (terminal-ui design, "Testing Strategy").
//
// It records every `proveBatch` call and holds each run open until a test calls `resolve`,
// `reject` or `progress` for it. It counts `cancelProve` calls and does nothing else on cancel,
// so a test chooses when (and whether) the old run settles. It never enforces one run at a time:
// "no second call" is something the terminal model must guarantee, and the test asserts it on
// `calls`. Synthetic data only. Nothing here prints anything.
import type { Batch } from '../../src/ledger/batch';
import type { SignedDigest } from '../../src/ledger/digest';
import type { Cents } from '../../src/ledger/posting';
import type { ProofBundle } from '../../src/zk/bundle';
import type { ProveService } from '../../src/zk/prove-service';

export interface FakeCall {
  readonly batch: Batch;
  readonly digest: SignedDigest;
  readonly limitCents: Cents;
  readonly onProgress: ((stage: string) => void) | undefined;
}

export interface FakeProve {
  readonly service: ProveService;
  /** Every `proveBatch` call, in order. */
  readonly calls: FakeCall[];
  /** Number of `cancelProve` calls. */
  readonly cancelCount: () => number;
  /** Reports a stage to the run at `index` (default: the latest call). */
  progress(stage: string, index?: number): void;
  /** Resolves the run at `index` (default: the latest call). */
  resolve(bundle: ProofBundle, index?: number): void;
  /** Rejects the run at `index` (default: the latest call) with any value. */
  reject(value: unknown, index?: number): void;
  /** The next `proveBatch` call throws `value` synchronously. */
  throwOnNextCall(value: unknown): void;
}

interface Pending {
  readonly resolve: (bundle: ProofBundle) => void;
  readonly reject: (value: unknown) => void;
}

export function createFakeProve(): FakeProve {
  const calls: FakeCall[] = [];
  const pending: Pending[] = [];
  let cancels = 0;
  let toThrow: { readonly value: unknown } | null = null;

  const indexOf = (index: number | undefined): number => {
    const i = index ?? calls.length - 1;
    if (!Number.isInteger(i) || i < 0 || i >= calls.length) throw new Error('FIXTURE: NO SUCH RUN');
    return i;
  };
  const at = <T>(items: readonly T[], i: number): T => {
    const item = items[i];
    if (item === undefined) throw new Error('FIXTURE: NO SUCH RUN');
    return item;
  };

  const service: ProveService = {
    proveBatch(batch, digest, limitCents, onProgress) {
      calls.push({ batch, digest, limitCents, onProgress });
      if (toThrow !== null) {
        const { value } = toThrow;
        toThrow = null;
        throw value;
      }
      return new Promise<ProofBundle>((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    },
    cancelProve() {
      cancels += 1;
    },
  };

  return {
    service,
    calls,
    cancelCount: () => cancels,
    progress: (stage, index) => at(calls, indexOf(index)).onProgress?.(stage),
    resolve: (bundle, index) => at(pending, indexOf(index)).resolve(bundle),
    reject: (value, index) => at(pending, indexOf(index)).reject(value),
    throwOnNextCall: (value) => {
      toThrow = { value };
    },
  };
}

/** A valid bundle with fixed public values, for example tests. Not a real proof. */
export function exampleBundle(overrides: Partial<ProofBundle> = {}): ProofBundle {
  return {
    batchId: 'CTB-20261201-001',
    recordCount: 2,
    merkleRoot: 7n,
    limitCents: 1_000_000n,
    signature: '0'.repeat(128),
    sourceKeyId: 'DEMO-0123456789abcdef',
    proof: new Uint8Array(96).fill(1),
    circuitVersion: `nargo-1.0.0+${'a'.repeat(32)}`,
    vkHash: 'b'.repeat(64),
    publicInputs: ['7', '2', '1000000'],
    ...overrides,
  };
}

/** Lets every queued microtask run (and one macrotask turn), so host callbacks have fired. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Polls with `tick` until `done()` is true, for work that waits on WebCrypto. Throws on timeout. */
export async function until(done: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > timeoutMs) throw new Error('FIXTURE: TIMEOUT WAITING FOR HOST');
    await tick();
  }
}
