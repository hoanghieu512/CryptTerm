// Prove_Service: the promise API that the terminal calls (zk-core design section C).
//
// `proveBatch` checks the digest and the batch on the page, then asks the proof worker for a proof
// and returns a proof bundle. One run at a time. A cancelled run never delivers a result: the
// worker is terminated, and every message carries the id of the run it belongs to.
//
// Privacy: a failure is a ProveError with a fixed reason and a fixed message. No posting value, no
// worker error text and no cause is ever put into an error, a progress call or a log.
import { checkBatch } from '../ledger/check-batch';
import type { Batch } from '../ledger/batch';
import type { SignedDigest } from '../ledger/digest';
import { isSignedDigestShape } from '../ledger/digest-shape';
import type { Cents } from '../ledger/posting';
import { bundleToJson, decodeBundle } from './bundle';
import type { ProofBundle } from './bundle';
import { CIRCUIT_VERSION, VK_HASH } from './circuit-identity';
import { openBrowserPort } from './worker-port';
import type { PortFactory, WorkerPort } from './worker-port';
import { isWorkerEvent } from './worker-protocol';
import type { ProveStage, WorkerEvent } from './worker-protocol';

export type ProveReason =
  | 'BUSY'
  | 'CANCELLED'
  | 'UNBALANCED'
  | 'OVER_LIMIT_UNFLAGGED'
  | 'OUT_OF_RANGE'
  | 'DIGEST_INVALID'
  | 'ASSET_FAILED'
  | 'WITNESS_FAILED'
  | 'PROVER_FAILED';

const PRECHECK_MESSAGES = {
  BUSY: 'PROOF RUN ALREADY ACTIVE',
  CANCELLED: 'PROOF RUN CANCELLED',
  UNBALANCED: 'PROOF GENERATION FAILED: DEBITS NOT EQUAL TO CREDITS',
  OVER_LIMIT_UNFLAGGED: 'PROOF GENERATION FAILED: POSTING OVER LIMIT WITHOUT REVIEW FLAG',
  OUT_OF_RANGE: 'PROOF GENERATION FAILED: VALUE OUT OF RANGE',
};

const WORKER_MESSAGES = {
  DIGEST_INVALID: 'PROOF GENERATION FAILED: SIGNED DIGEST INVALID',
  ASSET_FAILED: 'PROOF GENERATION FAILED: PROVER ASSETS NOT AVAILABLE',
  WITNESS_FAILED: 'PROOF GENERATION FAILED: WITNESS REJECTED BY CIRCUIT',
  PROVER_FAILED: 'PROOF GENERATION FAILED: PROVER ERROR',
};

export const PROVE_ERROR_MESSAGES: Readonly<Record<ProveReason, string>> = {
  ...PRECHECK_MESSAGES,
  ...WORKER_MESSAGES,
};

/** A failed or refused run. The message is fixed per reason and there is no cause. */
export class ProveError extends Error {
  readonly reason: ProveReason;
  constructor(reason: ProveReason) {
    super(PROVE_ERROR_MESSAGES[reason]);
    this.name = 'ProveError';
    this.reason = reason;
  }
}

type InputTexts = readonly [string, string, string];

// The bundle of a run: fields from the digest, the limit from the argument, the circuit identity
// from the generated constants, and the proof and public inputs from the worker.
function bundleFor(digest: SignedDigest, limitCents: Cents, proof: Uint8Array, publicInputs: InputTexts): ProofBundle {
  return {
    batchId: digest.batchId,
    recordCount: digest.recordCount,
    merkleRoot: BigInt(digest.merkleRoot),
    limitCents,
    signature: digest.signature,
    sourceKeyId: digest.sourceKeyId,
    proof,
    circuitVersion: CIRCUIT_VERSION,
    vkHash: VK_HASH,
    publicInputs,
  };
}

// A digest is usable when it has the SignedDigest shape and its fields fit the bundle rules (the
// source key id has a stricter rule in the bundle). The bundle codec answers the second question.
// The digest root is never compared with the batch root here: the verifier rejects that later.
function digestUsable(digest: SignedDigest): boolean {
  if (!isSignedDigestShape(digest)) return false;
  try {
    bundleToJson(bundleFor(digest, 0n, new Uint8Array(32), ['0', '0', '0']));
    return true;
  } catch {
    return false;
  }
}

interface Run {
  readonly runId: number;
  readonly digest: SignedDigest;
  readonly limitCents: Cents;
  readonly progress: (stage: ProveStage) => void;
  readonly resolve: (bundle: ProofBundle) => void;
  readonly reject: (error: ProveError) => void;
}

export interface ProveService {
  proveBatch(batch: Batch, digest: SignedDigest, limitCents: Cents, onProgress?: (stage: string) => void): Promise<ProofBundle>;
  // Rejects the active run with CANCELLED and stops its worker. No effect when nothing runs.
  cancelProve(): void;
}

export function createProveService(openPort: PortFactory): ProveService {
  let nextRunId = 1;
  let port: WorkerPort | undefined;
  let active: Run | null = null;

  // Ends the active run. The state is cleared before the promise settles.
  function settle(run: Run, finish: () => void): void {
    if (active === run) active = null;
    finish();
  }

  // Stops and forgets the current worker. Its late messages find no listener that matters.
  function dropPort(): void {
    port?.terminate();
    port = undefined;
  }

  // Opens the worker on the first run. A message counts only if it comes from the current port.
  function currentPort(): WorkerPort {
    if (port !== undefined) return port;
    const opened = openPort();
    opened.onMessage((message) => onMessage(opened, message));
    opened.onError(() => onWorkerError(opened));
    port = opened;
    return opened;
  }

  // The result of the worker as a validated bundle, or PROVER_FAILED if the codec refuses it.
  function finishRun(run: Run, event: Extract<WorkerEvent, { type: 'proved' }>): void {
    try {
      const candidate = bundleFor(run.digest, run.limitCents, event.proof, event.publicInputs);
      const bundle = decodeBundle(bundleToJson(candidate));
      settle(run, () => run.resolve(bundle));
    } catch {
      settle(run, () => run.reject(new ProveError('PROVER_FAILED')));
    }
  }

  // Only a well-formed event of the active run, from the current port, has any effect.
  function onMessage(from: WorkerPort, message: unknown): void {
    const run = active;
    if (from !== port || run === null || !isWorkerEvent(message) || message.runId !== run.runId) return;
    if (message.type === 'stage') run.progress(message.stage);
    else if (message.type === 'failed') settle(run, () => run.reject(new ProveError(message.code)));
    else if (message.type === 'proved') finishRun(run, message);
  }

  // A worker error ends the active run and the worker. No error text is read.
  function onWorkerError(from: WorkerPort): void {
    if (from !== port) return;
    const run = active;
    dropPort();
    if (run !== null) settle(run, () => run.reject(new ProveError('PROVER_FAILED')));
  }

  // The reason to refuse before any worker work, or undefined. The digest is checked first.
  function refusal(batch: Batch, digest: SignedDigest, limitCents: Cents): ProveReason | undefined {
    if (!digestUsable(digest)) return 'DIGEST_INVALID';
    const checked = checkBatch(batch, limitCents);
    return checked.ok ? undefined : checked.reason;
  }

  // A throw in the caller's progress function never reaches the run.
  function guarded(onProgress: ((stage: string) => void) | undefined): (stage: ProveStage) => void {
    return (stage) => {
      try {
        onProgress?.(stage);
      } catch {
        // The caller's callback failed. The run goes on.
      }
    };
  }

  function proveBatch(batch: Batch, digest: SignedDigest, limitCents: Cents, onProgress?: (stage: string) => void) {
    if (active !== null) return Promise.reject(new ProveError('BUSY'));
    return new Promise<ProofBundle>((resolve, reject) => {
      const run: Run = { runId: nextRunId, digest, limitCents, progress: guarded(onProgress), resolve, reject };
      nextRunId += 1;
      active = run;
      run.progress('PRECHECK');
      const reason = refusal(batch, digest, limitCents);
      if (reason !== undefined) return settle(run, () => reject(new ProveError(reason)));
      try {
        currentPort().post({ type: 'prove', runId: run.runId, postings: batch.postings, limitCents });
      } catch {
        dropPort();
        settle(run, () => reject(new ProveError('PROVER_FAILED')));
      }
    });
  }

  function cancelProve(): void {
    const run = active;
    if (run === null) return;
    dropPort();
    settle(run, () => run.reject(new ProveError('CANCELLED')));
  }

  return { proveBatch, cancelProve };
}

// The service of the page. Its worker opens on the first run, never at import time.
let browserService: ProveService | undefined;

function browser(): ProveService {
  browserService ??= createProveService(openBrowserPort);
  return browserService;
}

export const proveBatch: ProveService['proveBatch'] = (batch, digest, limitCents, onProgress) =>
  browser().proveBatch(batch, digest, limitCents, onProgress);

export function cancelProve(): void {
  browser().cancelProve();
}
