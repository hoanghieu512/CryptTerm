// Spike worker protocol: message types shared by the page, the worker and tests.
//
// RULE: no message carries a posting, leaf, root, limit, salt or error message
// string, EXCEPT `invalid-report`, which is the synthetic-data experiment
// Requirement 9 asks for. Failures travel as a stage name and a FailReason code.
//
// This module holds types, constants and runtime shape guards only. It touches
// no DOM, worker or console globals, so the page, the worker and tests can all
// import it.

export type Stage = 'WASM INIT' | 'WITNESS PREP' | 'EXECUTE' | 'PROVE' | 'VERIFY';

/** The five stages in run order (timing rows and their sum). */
export const STAGES: readonly Stage[] = [
  'WASM INIT',
  'WITNESS PREP',
  'EXECUTE',
  'PROVE',
  'VERIFY',
];

export type FailReason =
  | 'FETCH' | 'SRS_HASH' | 'SRS_REJECTED' | 'WASM_ERROR' // WASM INIT
  | 'FIELD_RANGE' // WITNESS PREP (field and slot, no value)
  | 'CONSTRAINT' // EXECUTE
  | 'SRS_TOO_SMALL' | 'PROVER_ERROR' // PROVE
  | 'PROOF_REJECTED' | 'VERIFIER_ERROR'; // VERIFY

export type InitDetailLabel = 'ARTIFACT' | 'ACVM AND ABI' | 'BB' | 'SRS FETCH' | 'SRS INIT';

export type LeakField = 'AMOUNT' | 'SALT' | 'ACCOUNT' | 'RECORD ID';

export interface ErrorShape {
  /** `typeof` the thrown value. */
  readonly typeofThrown: string;
  /** Constructor name, or null when the thrown value is not an object. */
  readonly ctorName: string | null;
  /** `Object.getOwnPropertyNames(error)` (includes non-enumerable), or null. */
  readonly ownPropertyNames: readonly string[] | null;
  readonly message: string | null;
}

export interface InvalidReport {
  readonly threw: boolean;
  readonly returnedWitness: boolean;
  /** Null shows NOT APPLICABLE. */
  readonly error: ErrorShape | null;
  /** Empty means NO. */
  readonly leaked: readonly LeakField[];
  readonly proof: null | {
    readonly threw: boolean;
    readonly error: ErrorShape | null;
    readonly verified: boolean | null;
  };
}

export type PageToWorker = { type: 'run' } | { type: 'run-invalid' };

export type WorkerToPage =
  | { type: 'stage-start'; stage: Stage }
  // ms: Math.floor of a performance.now() difference taken in the worker
  | { type: 'stage-end'; stage: Stage; ms: number }
  | { type: 'init-detail'; label: InitDetailLabel; ms: number }
  | { type: 'done'; proofBytes: number; workerIsolated: boolean }
  | {
      type: 'failed';
      stage: Stage;
      reason: FailReason;
      workerIsolated: boolean;
      have?: number;
      need?: number;
      field?: string;
      slot?: number;
    }
  | { type: 'invalid-report'; report: InvalidReport; workerIsolated: boolean };

const FAIL_REASONS: readonly FailReason[] = [
  'FETCH',
  'SRS_HASH',
  'SRS_REJECTED',
  'WASM_ERROR',
  'FIELD_RANGE',
  'CONSTRAINT',
  'SRS_TOO_SMALL',
  'PROVER_ERROR',
  'PROOF_REJECTED',
  'VERIFIER_ERROR',
];

const INIT_LABELS: readonly InitDetailLabel[] = [
  'ARTIFACT',
  'ACVM AND ABI',
  'BB',
  'SRS FETCH',
  'SRS INIT',
];

const LEAK_FIELDS: readonly LeakField[] = ['AMOUNT', 'SALT', 'ACCOUNT', 'RECORD ID'];

type Rec = Readonly<Record<string, unknown>>;

function isRec(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

function isFailReason(value: unknown): value is FailReason {
  return typeof value === 'string' && (FAIL_REASONS as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptional<T>(value: unknown, check: (v: unknown) => v is T): boolean {
  return value === undefined || check(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullOr(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === null || check(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isString);
}

function isErrorShape(value: unknown): value is ErrorShape {
  return (
    isRec(value) &&
    isString(value['typeofThrown']) &&
    isNullOr(value['ctorName'], isString) &&
    isNullOr(value['ownPropertyNames'], isStringArray) &&
    isNullOr(value['message'], isString)
  );
}

function isLeakField(value: unknown): value is LeakField {
  return typeof value === 'string' && (LEAK_FIELDS as readonly string[]).includes(value);
}

function isProofPart(value: unknown): boolean {
  return (
    isRec(value) &&
    isBoolean(value['threw']) &&
    isNullOr(value['error'], isErrorShape) &&
    isNullOr(value['verified'], isBoolean)
  );
}

function isInvalidReport(value: unknown): value is InvalidReport {
  return (
    isRec(value) &&
    isBoolean(value['threw']) &&
    isBoolean(value['returnedWitness']) &&
    isNullOr(value['error'], isErrorShape) &&
    Array.isArray(value['leaked']) &&
    value['leaked'].every(isLeakField) &&
    isNullOr(value['proof'], isProofPart)
  );
}

export function isPageToWorker(value: unknown): value is PageToWorker {
  return isRec(value) && (value['type'] === 'run' || value['type'] === 'run-invalid');
}

export function isWorkerToPage(value: unknown): value is WorkerToPage {
  if (!isRec(value)) return false;
  switch (value['type']) {
    case 'stage-start':
      return isStage(value['stage']);
    case 'stage-end':
      return isStage(value['stage']) && isFiniteNumber(value['ms']);
    case 'init-detail':
      return (
        typeof value['label'] === 'string' &&
        (INIT_LABELS as readonly string[]).includes(value['label']) &&
        isFiniteNumber(value['ms'])
      );
    case 'done':
      return isFiniteNumber(value['proofBytes']) && isBoolean(value['workerIsolated']);
    case 'failed':
      return (
        isStage(value['stage']) &&
        isFailReason(value['reason']) &&
        isBoolean(value['workerIsolated']) &&
        isOptional(value['have'], isFiniteNumber) &&
        isOptional(value['need'], isFiniteNumber) &&
        isOptional(value['field'], isString) &&
        isOptional(value['slot'], isFiniteNumber)
      );
    case 'invalid-report':
      return isInvalidReport(value['report']) && isBoolean(value['workerIsolated']);
    default:
      return false;
  }
}
