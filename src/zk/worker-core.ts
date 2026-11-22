// The logic of the proof worker, apart from the browser: it takes requests and posts events
// (zk-core design section C). The worker file and the tests both drive this same code.
//
// Privacy: a failure becomes a fixed code. The core never reads the message, the stack or any
// property of a caught value, and its catch blocks do not bind the value. Nothing is logged.
import { fieldToBytes32 } from '../ledger/field';
import type { CircuitInputs } from './circuit-inputs';
import type { Hasher } from './hash';
import { decodePublicInputs } from './prover';
import { buildCircuitInputs } from './witness-builder';
import { isWorkerRequest } from './worker-protocol';
import type { ProveRequest, PublicInputTexts, VerifyRequest, WorkerEvent, WorkerFailCode } from './worker-protocol';

export interface ProveOutput {
  readonly proof: Uint8Array[];
  readonly publicInputs: Uint8Array[];
}

export interface ProverSession {
  readonly hasher: Hasher;
  // The gzipped witness of one circuit run.
  execute(inputs: CircuitInputs): Promise<Uint8Array>;
  prove(witness: Uint8Array): Promise<ProveOutput>;
  close(): Promise<void>;
}

export interface VerifierSession {
  verify(proof: Uint8Array[], publicInputs: Uint8Array[]): Promise<boolean>;
  close(): Promise<void>;
}

// Opens the sessions. The browser backend loads the assets, a test backend is a stub.
export interface WorkerBackend {
  openProver(): Promise<ProverSession>;
  openVerifier(): Promise<VerifierSession>;
}

const ELEMENT_BYTES = 32;

// Joins proof elements into one byte string. There must be at least one, each of 32 bytes.
function joinElements(elements: readonly Uint8Array[]): Uint8Array {
  if (elements.length === 0 || elements.some((e) => e.length !== ELEMENT_BYTES)) throw new Error('PROOF SHAPE');
  const out = new Uint8Array(elements.length * ELEMENT_BYTES);
  elements.forEach((element, i) => out.set(element, i * ELEMENT_BYTES));
  return out;
}

// The three public inputs the prover used, as canonical decimals.
function inputTexts(elements: readonly Uint8Array[]): PublicInputTexts {
  const [a, b, c, ...extra] = decodePublicInputs(elements);
  if (a === undefined || b === undefined || c === undefined || extra.length > 0) throw new Error('INPUT SHAPE');
  return [a.toString(10), b.toString(10), c.toString(10)];
}

// A proof of whole 32-byte elements, or undefined for any other length.
function splitElements(proof: Uint8Array): Uint8Array[] | undefined {
  if (proof.length === 0 || proof.length % ELEMENT_BYTES !== 0) return undefined;
  const count = proof.length / ELEMENT_BYTES;
  return Array.from({ length: count }, (_, i) => proof.slice(i * ELEMENT_BYTES, (i + 1) * ELEMENT_BYTES));
}

export interface WorkerCore {
  // Handles one message. Anything that is not a well-formed request is dropped without a reply.
  handle(message: unknown): Promise<void>;
}

export function createWorkerCore(backend: WorkerBackend, post: (event: WorkerEvent) => void): WorkerCore {
  let prover: ProverSession | undefined;
  let verifier: VerifierSession | undefined;
  let queue: Promise<void> = Promise.resolve();

  // A failed session is closed and forgotten, so the next request starts clean.
  async function dropProver(): Promise<void> {
    const session = prover;
    prover = undefined;
    await session?.close().catch(() => undefined);
  }

  async function dropVerifier(): Promise<void> {
    const session = verifier;
    verifier = undefined;
    await session?.close().catch(() => undefined);
  }

  // Stages in order. A throw becomes the code of the stage it happened in, and nothing else.
  async function runProve(request: ProveRequest): Promise<void> {
    const { runId } = request;
    let code: WorkerFailCode = 'ASSET_FAILED';
    try {
      post({ type: 'stage', runId, stage: 'WASM INIT' });
      prover ??= await backend.openProver();
      const session = prover;
      code = 'WITNESS_FAILED';
      post({ type: 'stage', runId, stage: 'WITNESS PREP' });
      const built = await buildCircuitInputs(session.hasher, { postings: request.postings, limitCents: request.limitCents });
      post({ type: 'stage', runId, stage: 'EXECUTE' });
      const witness = await session.execute(built.inputs);
      code = 'PROVER_FAILED';
      post({ type: 'stage', runId, stage: 'PROVE' });
      const output = await session.prove(witness);
      const proof = joinElements(output.proof);
      const publicInputs = inputTexts(output.publicInputs);
      post({ type: 'proved', runId, proof, publicInputs });
    } catch {
      await dropProver();
      post({ type: 'failed', runId, code });
    }
  }

  // A proof that cannot be checked, or that makes the checker throw, is an invalid proof. Only a
  // failure to open the verifier (the key or the SRS) is reported as a failure.
  async function runVerify(request: VerifyRequest): Promise<void> {
    const { runId } = request;
    try {
      verifier ??= await backend.openVerifier();
    } catch {
      post({ type: 'failed', runId, code: 'ASSET_FAILED' });
      return;
    }
    let valid = false;
    try {
      const elements = splitElements(request.proof);
      const inputs = request.publicInputs.map((text) => fieldToBytes32(BigInt(text)));
      valid = elements !== undefined && (await verifier.verify(elements, inputs)) === true;
    } catch {
      await dropVerifier();
    }
    post({ type: 'verified', runId, valid });
  }

  return {
    handle(message) {
      if (!isWorkerRequest(message)) return Promise.resolve();
      const run = message.type === 'prove' ? () => runProve(message) : () => runVerify(message);
      queue = queue.then(run).catch(() => undefined);
      return queue;
    },
  };
}
