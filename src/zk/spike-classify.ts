// Failure classifier for the spike worker (Requirements 8.9, 14.8, 10.1).
//
// Maps a thrown value, the stage that was running and (inside WASM INIT) the part that was running
// to a `FailReason` code, plus the numbers the page shows (`have`, `need`, `field`, `slot`).
// The raw message is READ to choose a code and to parse two integers, and is never copied into
// the result. The result holds a code, two SRS point counts, a field NAME and a slot index.
//
// Pure functions. No DOM, worker or console globals, no network, so Node tests can import this
// module and the worker stays a thin shell around it.
import { FieldRangeError } from './errors';
import { describeError } from './spike-report';
import type { FailReason, Stage, WorkerToPage } from './spike-protocol';
import { SrsError } from './srs';

/**
 * The part of WASM INIT that was running. The five labels are the `init-detail` labels;
 * `ACIR` is the gunzip of the circuit bytecode, which has no `init-detail` row.
 */
export type InitPart = 'ARTIFACT' | 'ACVM AND ABI' | 'BB' | 'SRS FETCH' | 'SRS INIT' | 'ACIR';

/** A classified failure. `field` and `slot` are set for FIELD_RANGE, `have` and `need` for SRS_TOO_SMALL. */
export interface Classified {
  readonly reason: FailReason;
  readonly have?: number;
  readonly need?: number;
  readonly field?: string;
  readonly slot?: number;
}

/** Thrown by the worker when `circuitVerify` returns `verified === false`. Fixed message. */
export class ProofRejectedError extends Error {
  constructor() {
    super('PROOF REJECTED');
    this.name = 'ProofRejectedError';
  }
}

/** bb.js text for a prefix shorter than the prover needs (T7.7-f): `... too many points in <name>! <have> vs <need>`. */
const TOO_MANY_POINTS = 'too many points';
const HAVE_VS_NEED = /(\d{1,15})\s+vs\s+(\d{1,15})/;
/** The prefix `noir_js` puts before the assertion text of a failed constraint (T6.7). */
const CIRCUIT_FAILED_PREFIX = 'Circuit execution failed';

/** Whole milliseconds between two `performance.now()` readings. Never negative, never fractional. */
export function elapsedMs(startMs: number, endMs: number): number {
  const diff = Math.floor(endMs - startMs);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function parsePointCounts(message: string): { have?: number; need?: number } {
  const match = HAVE_VS_NEED.exec(message);
  if (match === null) return {};
  const have = Number(match[1]);
  const need = Number(match[2]);
  if (!Number.isSafeInteger(have) || !Number.isSafeInteger(need)) return {};
  return { have, need };
}

function classifyInit(error: unknown, part: InitPart | null): Classified {
  if (error instanceof SrsError) {
    return { reason: error.code === 'SRS_FETCH' ? 'FETCH' : 'SRS_HASH' };
  }
  switch (part) {
    case 'ARTIFACT':
    case 'SRS FETCH':
      return { reason: 'FETCH' };
    case 'SRS INIT':
      // `srsInitSrs` rejected the bytes (bb.js checks the generator points and the G2 point).
      return { reason: 'SRS_REJECTED' };
    case 'ACVM AND ABI':
    case 'BB':
    case 'ACIR':
    case null:
      return { reason: 'WASM_ERROR' };
    default: {
      const unreachable: never = part;
      return unreachable;
    }
  }
}

/**
 * Chooses the `FailReason` for a throw. Order: a range error from the witness builder, a coded SRS
 * error, the bb.js `too many points` text, a rejected proof, then the stage (and init part).
 * `part` matters only while `stage` is `WASM INIT`.
 */
export function classifyFailure(error: unknown, stage: Stage, part: InitPart | null): Classified {
  if (error instanceof FieldRangeError) {
    return error.slot === null
      ? { reason: 'FIELD_RANGE', field: error.field }
      : { reason: 'FIELD_RANGE', field: error.field, slot: error.slot };
  }
  if (error instanceof ProofRejectedError) return { reason: 'PROOF_REJECTED' };
  if (stage === 'WASM INIT') return classifyInit(error, part);
  const message = describeError(error).message ?? '';
  if (message.includes(TOO_MANY_POINTS)) {
    return { reason: 'SRS_TOO_SMALL', ...parsePointCounts(message) };
  }
  switch (stage) {
    case 'WITNESS PREP':
      return { reason: 'WASM_ERROR' }; // a hashing failure in bb.js; range errors were handled above
    case 'EXECUTE':
      return { reason: message.includes(CIRCUIT_FAILED_PREFIX) ? 'CONSTRAINT' : 'WASM_ERROR' };
    case 'PROVE':
      return { reason: 'PROVER_ERROR' };
    case 'VERIFY':
      return { reason: 'VERIFIER_ERROR' };
    default: {
      const unreachable: never = stage;
      return unreachable;
    }
  }
}

/** The `failed` message for a classified failure. Carries codes and numbers only. */
export function failedMessage(
  stage: Stage,
  classified: Classified,
  workerIsolated: boolean,
): WorkerToPage {
  const message: Extract<WorkerToPage, { type: 'failed' }> = {
    type: 'failed',
    stage,
    reason: classified.reason,
    workerIsolated,
  };
  return {
    ...message,
    ...(classified.have === undefined ? {} : { have: classified.have }),
    ...(classified.need === undefined ? {} : { need: classified.need }),
    ...(classified.field === undefined ? {} : { field: classified.field }),
    ...(classified.slot === undefined ? {} : { slot: classified.slot }),
  };
}
