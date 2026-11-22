// Test transport and stub backend for the worker protocol (zk-core design section C).
// createInProcessPort gives the Prove_Service and the verify client a WorkerPort without a
// browser Worker: requests are cloned and handled by the real worker core, and events come back
// as clones on a later microtask, like real messages. createStubBackend stands in for noir_js
// and bb.js. Synthetic data only, and nothing here prints anything.
import { fieldToBytes32 } from '../../src/ledger/field';
import type { Hasher } from '../../src/zk/hash';
import type { WorkerPort } from '../../src/zk/worker-port';
import { createWorkerCore } from '../../src/zk/worker-core';
import type { WorkerBackend } from '../../src/zk/worker-core';
import type { WorkerEvent, WorkerRequest } from '../../src/zk/worker-protocol';

// The stage at which the stub throws an error whose message holds the sentinel.
export type FailAt = 'openProver' | 'hash' | 'execute' | 'prove' | 'openVerifier' | 'verify';

export interface StubOptions {
  readonly failAt?: FailAt;
  readonly sentinel?: string;
  // Hold `prove` until `control.release()` is called.
  readonly hold?: boolean;
  // What the stub prover returns: [merkle_root, record_count, limit_cents].
  readonly publicInputs?: readonly [bigint, bigint, bigint];
  readonly proofElements?: number;
  readonly elementBytes?: number;
  readonly verifyResult?: boolean;
}

export interface StubControl {
  release(): void;
  readonly counts: { openProver: number; prove: number; openVerifier: number; verify: number };
}

const DEFAULT_INPUTS: readonly [bigint, bigint, bigint] = [11n, 22n, 33n];

export function createStubBackend(options: StubOptions = {}): { backend: WorkerBackend; control: StubControl } {
  const counts = { openProver: 0, prove: 0, openVerifier: 0, verify: 0 };
  // Each held `prove` call waits here until `control.release()` frees the ones waiting now.
  const waiting: (() => void)[] = [];
  const boom = (at: FailAt): void => {
    if (options.failAt === at) throw new Error(`STUB ${at} ${options.sentinel ?? ''}`);
  };
  const hasher: Hasher = {
    hashLeaf: async () => {
      boom('hash');
      return 1n;
    },
    hashNode: async () => 2n,
  };
  const prover = {
    hasher,
    execute: async () => {
      boom('execute');
      return new Uint8Array(4);
    },
    prove: async () => {
      counts.prove += 1;
      if (options.hold === true) await new Promise<void>((resolve) => waiting.push(resolve));
      boom('prove');
      const size = options.elementBytes ?? 32;
      const proof = Array.from({ length: options.proofElements ?? 3 }, (_, i) => new Uint8Array(size).fill(i + 1));
      const publicInputs = (options.publicInputs ?? DEFAULT_INPUTS).map((v) => fieldToBytes32(v));
      return { proof, publicInputs };
    },
    close: async () => undefined,
  };
  const verifier = {
    verify: async () => {
      counts.verify += 1;
      boom('verify');
      return options.verifyResult ?? true;
    },
    close: async () => undefined,
  };
  const backend: WorkerBackend = {
    openProver: async () => {
      counts.openProver += 1;
      boom('openProver');
      return prover;
    },
    openVerifier: async () => {
      counts.openVerifier += 1;
      boom('openVerifier');
      return verifier;
    },
  };
  return { backend, control: { release: () => waiting.splice(0).forEach((resolve) => resolve()), counts } };
}

export interface InProcessPort extends WorkerPort {
  readonly terminated: boolean;
  // Delivers a message to the page handler at once, even after terminate (a late message).
  emit(message: unknown): void;
  // Fires the worker error handler, as a real worker error event would.
  triggerError(): void;
  // Every request the page posted, and every event the core posted, as clones.
  readonly requests: WorkerRequest[];
  readonly events: WorkerEvent[];
}

export function createInProcessPort(backend: WorkerBackend): InProcessPort {
  let onMessage: (message: unknown) => void = () => undefined;
  let onError: () => void = () => undefined;
  let stopped = false;
  const requests: WorkerRequest[] = [];
  const events: WorkerEvent[] = [];
  const core = createWorkerCore(backend, (event) => {
    events.push(structuredClone(event));
    queueMicrotask(() => {
      if (!stopped) onMessage(structuredClone(event));
    });
  });
  return {
    post(message) {
      if (stopped) return;
      requests.push(structuredClone(message));
      void core.handle(structuredClone(message));
    },
    onMessage: (handler) => {
      onMessage = handler;
    },
    onError: (handler) => {
      onError = handler;
    },
    terminate: () => {
      stopped = true;
    },
    emit: (message) => onMessage(message),
    triggerError: () => onError(),
    get terminated() {
      return stopped;
    },
    requests,
    events,
  };
}
