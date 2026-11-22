// Messages between the page and the proof worker (zk-core design section C).
//
// Page to worker: a `prove` request with the postings, or a `verify` request with the proof
// bytes and the public inputs. Worker to page: stage names, a code, a boolean, or public values.
// Every message carries a run id, so the page can ignore a message of another run. No event ever
// carries a posting value or the text of a thrown error.
import type { Cents, Posting } from '../ledger/posting';

export type WorkerStage = 'WASM INIT' | 'WITNESS PREP' | 'EXECUTE' | 'PROVE';
// PRECHECK is reported by the page itself, before any message is posted to the worker.
export type ProveStage = 'PRECHECK' | WorkerStage;
export const PROVE_STAGES: readonly ProveStage[] = ['PRECHECK', 'WASM INIT', 'WITNESS PREP', 'EXECUTE', 'PROVE'];
export type WorkerFailCode = 'ASSET_FAILED' | 'WITNESS_FAILED' | 'PROVER_FAILED';
export type PublicInputTexts = readonly [string, string, string];

export interface ProveRequest {
  readonly type: 'prove';
  readonly runId: number;
  readonly postings: readonly Posting[];
  readonly limitCents: Cents;
}

export interface VerifyRequest {
  readonly type: 'verify';
  readonly runId: number;
  readonly proof: Uint8Array;
  readonly publicInputs: PublicInputTexts;
}

export type WorkerRequest = ProveRequest | VerifyRequest;

export type WorkerEvent =
  | { readonly type: 'stage'; readonly runId: number; readonly stage: WorkerStage }
  | { readonly type: 'proved'; readonly runId: number; readonly proof: Uint8Array; readonly publicInputs: PublicInputTexts }
  | { readonly type: 'verified'; readonly runId: number; readonly valid: boolean }
  | { readonly type: 'failed'; readonly runId: number; readonly code: WorkerFailCode };

const STAGES: readonly string[] = ['WASM INIT', 'WITNESS PREP', 'EXECUTE', 'PROVE'];
const FAIL_CODES: readonly string[] = ['ASSET_FAILED', 'WITNESS_FAILED', 'PROVER_FAILED'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A run id is a positive safe integer.
function hasRunId(value: Record<string, unknown>): boolean {
  const id = value['runId'];
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

function isInputTexts(value: unknown): value is PublicInputTexts {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'string');
}

/** True for a well-formed request. The postings themselves are range-checked by the witness builder. */
export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value) || !hasRunId(value)) return false;
  if (value['type'] === 'prove') return Array.isArray(value['postings']) && typeof value['limitCents'] === 'bigint';
  if (value['type'] !== 'verify') return false;
  return value['proof'] instanceof Uint8Array && isInputTexts(value['publicInputs']);
}

/** True for a well-formed event. Anything else is dropped by the page. */
export function isWorkerEvent(value: unknown): value is WorkerEvent {
  if (!isRecord(value) || !hasRunId(value)) return false;
  switch (value['type']) {
    case 'stage':
      return typeof value['stage'] === 'string' && STAGES.includes(value['stage']);
    case 'proved':
      return value['proof'] instanceof Uint8Array && isInputTexts(value['publicInputs']);
    case 'verified':
      return typeof value['valid'] === 'boolean';
    case 'failed':
      return typeof value['code'] === 'string' && FAIL_CODES.includes(value['code']);
    default:
      return false;
  }
}
