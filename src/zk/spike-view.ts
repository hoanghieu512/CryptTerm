// Spike page view model: the copy table, a pure reducer and a pure renderer.
//
// This module is the ONLY source of visible strings for the spike page. Every string in `COPY` is
// uppercase in the source (Requirement 8.13). The 10-word limit applies to OUR status and error
// lines (decision D6). The raw error message of the invalid-witness report is quoted data: it is
// returned separately (`rawErrorMessage`), is part of no status line, and is exempt from the limit.
// Report values that are quoted data (`quoted: true`, such as a constructor name) keep their case,
// and the page shows them with CSS `text-transform: uppercase`.
//
// Pure: no DOM, no worker globals, no `console`, no clock. The page passes the clock reading and
// `crossOriginIsolated` in through the event (see `ReceiveContext`). Imports types and constants
// from `spike-protocol.ts` only.
//
// Word budget. The longest status line is `FAILED <STAGE>: <REASON>`. The longest stage name,
// WITNESS PREP, has 2 words. The longest field-range reason is `REVIEW FLAG OUT OF RANGE SLOT 12`
// (7 words), so `FAILED WITNESS PREP: REVIEW FLAG OUT OF RANGE SLOT 12` has 10 words. The design
// copy table writes the reason as `<FIELD> OUT OF RANGE AT SLOT <N>`; with `AT` that line would
// have 11 words, so `AT` is dropped here (the design's own longest example has no `AT` either).
//
// TOTAL >= sum of the five stage times. Each stage time is `Math.floor` of a difference taken in the
// worker, and TOTAL is `Math.ceil` of a longer interval on the page that starts before the worker
// exists and ends after the last stage. The floored parts are not larger than their intervals, the
// intervals do not overlap, and the ceiling is not smaller than the whole, so the inequality holds
// by construction. The reducer stores both numbers as received (floored, ceiled) and does not
// adjust either, so a violation would show in the table. `stageSum` exposes the sum.
import { STAGES } from './spike-protocol';
import type {
  FailReason,
  InitDetailLabel,
  InvalidReport,
  ErrorShape,
  Stage,
  WorkerToPage,
} from './spike-protocol';

// ---------------------------------------------------------------------------
// Copy table
// ---------------------------------------------------------------------------

export const COPY = {
  TITLE: 'CRYPTTERM ZK SPIKE',
  DEMO_LABEL: 'DEMO DATA',

  // Controls
  RUN: 'RUN',
  INVALID_WITNESS: 'INVALID WITNESS',

  // Status line pieces: `RUNNING: <STAGE>`, `VERIFIED`, `FAILED <WHERE>: <REASON>`
  READY: 'READY',
  RUNNING: 'RUNNING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  INVALID_RUN: 'INVALID WITNESS RUN',
  INVALID_RUN_FINISHED: 'INVALID WITNESS RUN FINISHED',

  // Failure reasons (the text after `FAILED <STAGE>: `)
  FAIL_FETCH: 'FILE LOAD FAILED',
  FAIL_SRS_HASH: 'SRS HASH DOES NOT MATCH MANIFEST',
  FAIL_SRS_REJECTED: 'SRS REJECTED BY PROVER LIBRARY',
  FAIL_WASM_ERROR: 'WASM LIBRARY ERROR',
  // `<FIELD> OUT OF RANGE SLOT <N>`, or `<FIELD> OUT OF RANGE` for the two scalars
  FAIL_FIELD_RANGE: 'OUT OF RANGE',
  FAIL_FIELD_RANGE_SLOT: 'SLOT',
  FAIL_FIELD_UNKNOWN: 'FIELD',
  FAIL_CONSTRAINT: 'CIRCUIT CONSTRAINT FAILED',
  FAIL_SRS_TOO_SMALL: 'SRS TOO SMALL FOR CIRCUIT',
  FAIL_PROVER_ERROR: 'PROOF GENERATION ERROR',
  FAIL_PROOF_REJECTED: 'PROOF REJECTED BY VERIFIER',
  FAIL_VERIFIER_ERROR: 'VERIFIER LIBRARY ERROR',
  FAIL_WORKER_ERROR: 'WORKER REPORTED AN ERROR', // worker `error`, `messageerror`, protocol violation

  // Timeout of the invalid-witness run: status `FAILED INVALID WITNESS RUN: TIMEOUT`, detail below
  TIMEOUT_TAG: 'TIMEOUT',
  TIMEOUT: 'NO RESULT WITHIN 120 SECONDS',

  // Field labels for FAIL_FIELD_RANGE (same wording as `errors.ts`, keyed by PostingFieldName)
  FIELD_LABELS: {
    recordId: 'RECORD ID',
    account: 'ACCOUNT',
    side: 'SIDE',
    amountCents: 'AMOUNT',
    reviewFlag: 'REVIEW FLAG',
    salt: 'SALT',
    limitCents: 'LIMIT',
    recordCount: 'RECORD COUNT',
  },

  // Result rows
  UNIT_MS: 'MS',
  TOTAL: 'TOTAL',
  PROOF_SIZE: 'PROOF SIZE (BYTES)',
  ISOLATED_PAGE: 'CROSS ORIGIN ISOLATED (PAGE)',
  ISOLATED_WORKER: 'CROSS ORIGIN ISOLATED (WORKER)',
  INIT_PART_PREFIX: 'WASM INIT PART', // `WASM INIT PART: <LABEL>`; not part of the stage sum

  // Invalid-witness report
  EXECUTE_THREW: 'EXECUTE THREW',
  RETURNED_WITNESS: 'RETURNED WITNESS',
  ERROR_CONSTRUCTOR: 'ERROR CONSTRUCTOR',
  ERROR_PROPERTIES: 'ERROR PROPERTIES',
  ERROR_MESSAGE: 'ERROR MESSAGE',
  PRIVATE_VALUE_IN_ERROR: 'PRIVATE VALUE IN ERROR',
  PROOF_ATTEMPT_THREW: 'PROOF ATTEMPT THREW',
  PROOF_ERROR_CONSTRUCTOR: 'PROOF ERROR CONSTRUCTOR',
  PROOF_ERROR_PROPERTIES: 'PROOF ERROR PROPERTIES',
  PROOF_ERROR_MESSAGE: 'PROOF ERROR MESSAGE',
  PROOF_VERIFIED: 'PROOF VERIFIED',
  NOT_APPLICABLE: 'NOT APPLICABLE',
  NONE: 'NONE',
  YES: 'YES',
  NO: 'NO',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  LEAK_PREFIX: 'YES: ', // `YES: AMOUNT, SALT`
} as const;

const SEPARATOR = ', ';

// ---------------------------------------------------------------------------
// Failure reasons
// ---------------------------------------------------------------------------

/** A worker FailReason, or the page-side reason for a worker error or a protocol violation. */
export type ViewReason = FailReason | 'WORKER_ERROR';

/** Largest slot number printed as a slot. Capacity is 64; anything else prints the no-slot form. */
const SLOT_PRINT_MAX = 999;

const FIELD_LABELS: ReadonlyMap<string, string> = new Map(Object.entries(COPY.FIELD_LABELS));

function fieldRangeText(field: string | undefined, slot: number | undefined): string {
  // The raw `field` string is never echoed: an unknown name prints a neutral label.
  const label = (field === undefined ? undefined : FIELD_LABELS.get(field)) ?? COPY.FAIL_FIELD_UNKNOWN;
  const base = `${label} ${COPY.FAIL_FIELD_RANGE}`;
  if (slot !== undefined && Number.isInteger(slot) && slot >= 0 && slot <= SLOT_PRINT_MAX) {
    return `${base} ${COPY.FAIL_FIELD_RANGE_SLOT} ${slot}`;
  }
  return base;
}

/** Text for a failure reason. Total: the `never` check fails to compile when a reason is missing. */
export function reasonText(reason: ViewReason, field?: string, slot?: number): string {
  switch (reason) {
    case 'FETCH':
      return COPY.FAIL_FETCH;
    case 'SRS_HASH':
      return COPY.FAIL_SRS_HASH;
    case 'SRS_REJECTED':
      return COPY.FAIL_SRS_REJECTED;
    case 'WASM_ERROR':
      return COPY.FAIL_WASM_ERROR;
    case 'FIELD_RANGE':
      return fieldRangeText(field, slot);
    case 'CONSTRAINT':
      return COPY.FAIL_CONSTRAINT;
    case 'SRS_TOO_SMALL':
      return COPY.FAIL_SRS_TOO_SMALL;
    case 'PROVER_ERROR':
      return COPY.FAIL_PROVER_ERROR;
    case 'PROOF_REJECTED':
      return COPY.FAIL_PROOF_REJECTED;
    case 'VERIFIER_ERROR':
      return COPY.FAIL_VERIFIER_ERROR;
    case 'WORKER_ERROR':
      return COPY.FAIL_WORKER_ERROR;
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}

/** `FAILED <WHERE>: <REASON>` */
function failedLine(where: string, reason: string): string {
  return `${COPY.FAILED} ${where}: ${reason}`;
}

// ---------------------------------------------------------------------------
// State and events
// ---------------------------------------------------------------------------

export type RunMode = 'valid' | 'invalid';

/** Completed stage times, whole milliseconds (floored in the worker). */
export type Timings = Readonly<Partial<Record<Stage, number>>>;
/** Parts of WASM INIT, whole milliseconds. Secondary rows, never in the stage sum. */
export type InitDetail = Readonly<Partial<Record<InitDetailLabel, number>>>;

export interface ValidOutcome {
  readonly mode: 'valid';
  /** `Math.ceil(performance.now() - t0)` on the page when `done` arrived. */
  readonly totalMs: number;
  readonly proofBytes: number;
  readonly pageIsolated: boolean;
  readonly workerIsolated: boolean;
}

export interface InvalidOutcome {
  readonly mode: 'invalid';
  readonly report: InvalidReport;
}

export type ViewState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'running';
      readonly mode: RunMode;
      readonly stage: Stage;
      readonly timings: Timings;
      readonly initDetail: InitDetail;
    }
  | {
      readonly kind: 'succeeded';
      readonly timings: Timings;
      readonly initDetail: InitDetail;
      readonly outcome: ValidOutcome | InvalidOutcome;
    }
  | {
      readonly kind: 'failed';
      readonly mode: RunMode;
      readonly stage: Stage;
      readonly reason: ViewReason;
      readonly field: string | undefined;
      readonly slot: number | undefined;
      readonly timings: Timings;
      readonly initDetail: InitDetail;
    }
  | {
      readonly kind: 'timedOut';
      readonly timings: Timings;
      readonly initDetail: InitDetail;
    };

/**
 * What the page reads at the moment a worker message arrives. The page measures; the reducer stays
 * pure. `totalMs` is `Math.ceil(performance.now() - t0)` and only the `done` message uses it.
 */
export interface ReceiveContext {
  readonly totalMs: number;
  readonly pageIsolated: boolean;
}

export type ViewEvent =
  | { readonly type: 'run' }
  | { readonly type: 'run-invalid' }
  | {
      readonly type: 'worker-message';
      readonly message: WorkerToPage;
      readonly context: ReceiveContext;
    }
  /** Worker `error` or `messageerror`: a failure of the stage that is running. */
  | { readonly type: 'worker-error' }
  /** The 120 s timer of the invalid-witness run fired. Ignored outside that run. */
  | { readonly type: 'timeout' };

export const INITIAL_STATE: ViewState = { kind: 'idle' };

/** Controls (RUN and INVALID WITNESS) are disabled exactly while a run is in progress. */
export function controlsDisabled(state: ViewState): boolean {
  return state.kind === 'running';
}

function timingsOf(state: ViewState): Timings {
  return state.kind === 'idle' ? {} : state.timings;
}

/** Sum of the completed stage times (whole milliseconds). `initDetail` parts are not included. */
export function stageSum(state: ViewState): number {
  const timings = timingsOf(state);
  let sum = 0;
  for (const stage of STAGES) sum += timings[stage] ?? 0;
  return sum;
}

type RunningState = Extract<ViewState, { kind: 'running' }>;

function failRunning(
  state: RunningState,
  stage: Stage,
  reason: ViewReason,
  field?: string,
  slot?: number,
): ViewState {
  return {
    kind: 'failed',
    mode: state.mode,
    stage,
    reason,
    field,
    slot,
    timings: state.timings,
    initDetail: state.initDetail,
  };
}

/** Whole, non-negative milliseconds. A stage time arrives floored; this guards a bad value. */
function wholeMs(value: number, round: (n: number) => number): number {
  return Math.max(0, round(value));
}

function allStagesDone(timings: Timings): boolean {
  return STAGES.every((stage) => timings[stage] !== undefined);
}

function onMessage(state: RunningState, message: WorkerToPage, context: ReceiveContext): ViewState {
  switch (message.type) {
    case 'stage-start':
      return { ...state, stage: message.stage };
    case 'stage-end':
      return {
        ...state,
        timings: { ...state.timings, [message.stage]: wholeMs(message.ms, Math.floor) },
      };
    case 'init-detail':
      return {
        ...state,
        initDetail: { ...state.initDetail, [message.label]: wholeMs(message.ms, Math.floor) },
      };
    case 'done': {
      // Fail closed: VERIFIED only when this was a valid run, all five stage rows exist and the
      // numbers are usable. Anything else is a protocol violation, shown as a worker error.
      const usable =
        state.mode === 'valid' &&
        allStagesDone(state.timings) &&
        Number.isSafeInteger(message.proofBytes) &&
        message.proofBytes >= 1 &&
        Number.isFinite(context.totalMs);
      if (!usable) return failRunning(state, state.stage, 'WORKER_ERROR');
      return {
        kind: 'succeeded',
        timings: state.timings,
        initDetail: state.initDetail,
        outcome: {
          mode: 'valid',
          totalMs: wholeMs(context.totalMs, Math.ceil),
          proofBytes: message.proofBytes,
          pageIsolated: context.pageIsolated,
          workerIsolated: message.workerIsolated,
        },
      };
    }
    case 'failed':
      return failRunning(state, message.stage, message.reason, message.field, message.slot);
    case 'invalid-report':
      if (state.mode !== 'invalid') return failRunning(state, state.stage, 'WORKER_ERROR');
      return {
        kind: 'succeeded',
        timings: state.timings,
        initDetail: state.initDetail,
        outcome: { mode: 'invalid', report: message.report },
      };
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}

function start(state: ViewState, mode: RunMode): ViewState {
  if (state.kind === 'running') return state; // a second press starts no second run
  const first = STAGES[0];
  if (first === undefined) return state; // STAGES is a non-empty constant
  return { kind: 'running', mode, stage: first, timings: {}, initDetail: {} };
}

/**
 * The reducer. Returns the SAME state object when an event changes nothing: a `run` while running,
 * and any worker event, error or timeout when no run is in progress (late messages after a
 * failure or a timeout, which the page has already terminated, are dropped).
 *
 * A new run begins at stage WASM INIT, because worker start-up belongs to that stage's interval.
 * A worker error before the first `stage-start` therefore names WASM INIT.
 */
export function reduce(state: ViewState, event: ViewEvent): ViewState {
  switch (event.type) {
    case 'run':
      return start(state, 'valid');
    case 'run-invalid':
      return start(state, 'invalid');
    case 'worker-message':
      return state.kind === 'running' ? onMessage(state, event.message, event.context) : state;
    case 'worker-error':
      return state.kind === 'running' ? failRunning(state, state.stage, 'WORKER_ERROR') : state;
    case 'timeout':
      return state.kind === 'running' && state.mode === 'invalid'
        ? { kind: 'timedOut', timings: state.timings, initDetail: state.initDetail }
        : state;
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface Row {
  readonly label: string;
  readonly value: string;
  /** A part of WASM INIT: shown as a secondary row, not in the stage sum. */
  readonly secondary: boolean;
  /** Report data (constructor name, property names) that keeps its case; the page uppercases it by CSS. */
  readonly quoted: boolean;
}

export interface ViewModel {
  readonly title: string;
  /** Always `DEMO DATA`, in every state. */
  readonly demoLabel: string;
  readonly runLabel: string;
  readonly invalidWitnessLabel: string;
  readonly statusLine: string;
  /** A second line under the status, or null. Only the timeout has one. */
  readonly detailLine: string | null;
  readonly controlsDisabled: boolean;
  readonly rows: readonly Row[];
  /** Raw `message` of the error thrown by `execute`, shown in a `<pre>` under `rawErrorLabel`. Null when none. */
  readonly rawErrorMessage: string | null;
  readonly rawErrorLabel: string;
  /** Raw `message` of the error thrown by the proof attempt, under `rawProofErrorLabel`. Null when none. */
  readonly rawProofErrorMessage: string | null;
  readonly rawProofErrorLabel: string;
}

const INIT_DETAIL_ORDER: readonly InitDetailLabel[] = [
  'ARTIFACT',
  'ACVM AND ABI',
  'BB',
  'SRS FETCH',
  'SRS INIT',
];

function row(label: string, value: string): Row {
  return { label, value, secondary: false, quoted: false };
}

function msText(ms: number): string {
  return `${ms} ${COPY.UNIT_MS}`;
}

function yesNo(value: boolean): string {
  return value ? COPY.YES : COPY.NO;
}

function trueFalse(value: boolean): string {
  return value ? COPY.TRUE : COPY.FALSE;
}

function stageRows(timings: Timings, initDetail: InitDetail): Row[] {
  const rows: Row[] = [];
  for (const stage of STAGES) {
    const ms = timings[stage];
    if (ms !== undefined) rows.push(row(stage, msText(ms)));
    if (stage === 'WASM INIT') {
      for (const label of INIT_DETAIL_ORDER) {
        const part = initDetail[label];
        if (part !== undefined) {
          rows.push({
            label: `${COPY.INIT_PART_PREFIX}: ${label}`,
            value: msText(part),
            secondary: true,
            quoted: false,
          });
        }
      }
    }
  }
  return rows;
}

interface ErrorRows {
  readonly rows: readonly Row[];
  readonly rawMessage: string | null;
}

/**
 * Constructor, property names and message of a thrown value. A null error shows NOT APPLICABLE.
 * A thrown value that is not an object shows its `typeof` in place of the constructor name and the
 * property names. A message that exists is returned as `rawMessage` (no row); a missing one is a row.
 */
function errorRows(
  constructorLabel: string,
  propertiesLabel: string,
  messageLabel: string,
  error: ErrorShape | null,
): ErrorRows {
  if (error === null) {
    return {
      rows: [
        row(constructorLabel, COPY.NOT_APPLICABLE),
        row(propertiesLabel, COPY.NOT_APPLICABLE),
        row(messageLabel, COPY.NOT_APPLICABLE),
      ],
      rawMessage: null,
    };
  }
  const names = error.ownPropertyNames;
  const rows: Row[] = [
    { label: constructorLabel, value: error.ctorName ?? error.typeofThrown, secondary: false, quoted: true },
    {
      label: propertiesLabel,
      value: names === null ? error.typeofThrown : names.length === 0 ? COPY.NONE : names.join(SEPARATOR),
      secondary: false,
      quoted: true,
    },
  ];
  if (error.message === null) rows.push(row(messageLabel, COPY.NONE));
  return { rows, rawMessage: error.message };
}

interface ReportRows {
  readonly rows: readonly Row[];
  readonly rawErrorMessage: string | null;
  readonly rawProofErrorMessage: string | null;
}

function reportRows(report: InvalidReport): ReportRows {
  const rows: Row[] = [
    row(COPY.EXECUTE_THREW, yesNo(report.threw)),
    row(COPY.RETURNED_WITNESS, yesNo(report.returnedWitness)),
  ];
  const main = errorRows(COPY.ERROR_CONSTRUCTOR, COPY.ERROR_PROPERTIES, COPY.ERROR_MESSAGE, report.error);
  rows.push(...main.rows);
  rows.push(
    row(
      COPY.PRIVATE_VALUE_IN_ERROR,
      report.leaked.length === 0 ? COPY.NO : `${COPY.LEAK_PREFIX}${report.leaked.join(SEPARATOR)}`,
    ),
  );
  let rawProofErrorMessage: string | null = null;
  const proof = report.proof;
  if (proof !== null) {
    rows.push(row(COPY.PROOF_ATTEMPT_THREW, yesNo(proof.threw)));
    if (proof.threw) {
      const proofError = errorRows(
        COPY.PROOF_ERROR_CONSTRUCTOR,
        COPY.PROOF_ERROR_PROPERTIES,
        COPY.PROOF_ERROR_MESSAGE,
        proof.error,
      );
      rows.push(...proofError.rows);
      rawProofErrorMessage = proofError.rawMessage;
    }
    if (proof.verified !== null) rows.push(row(COPY.PROOF_VERIFIED, trueFalse(proof.verified)));
  }
  return { rows, rawErrorMessage: main.rawMessage, rawProofErrorMessage };
}

interface Body {
  readonly statusLine: string;
  readonly detailLine: string | null;
  readonly rows: readonly Row[];
  readonly rawErrorMessage: string | null;
  readonly rawProofErrorMessage: string | null;
}

function body(state: ViewState): Body {
  const none = { detailLine: null, rawErrorMessage: null, rawProofErrorMessage: null } as const;
  switch (state.kind) {
    case 'idle':
      return { ...none, statusLine: COPY.READY, rows: [] };
    case 'running':
      return {
        ...none,
        statusLine: `${COPY.RUNNING}: ${state.stage}`,
        rows: stageRows(state.timings, state.initDetail),
      };
    case 'failed':
      return {
        ...none,
        statusLine: failedLine(state.stage, reasonText(state.reason, state.field, state.slot)),
        rows: stageRows(state.timings, state.initDetail),
      };
    case 'timedOut':
      return {
        ...none,
        statusLine: failedLine(COPY.INVALID_RUN, COPY.TIMEOUT_TAG),
        detailLine: COPY.TIMEOUT,
        rows: stageRows(state.timings, state.initDetail),
      };
    case 'succeeded': {
      const stages = stageRows(state.timings, state.initDetail);
      const outcome = state.outcome;
      if (outcome.mode === 'valid') {
        return {
          ...none,
          statusLine: COPY.VERIFIED,
          rows: [
            ...stages,
            row(COPY.TOTAL, msText(outcome.totalMs)),
            row(COPY.PROOF_SIZE, `${outcome.proofBytes}`),
            row(COPY.ISOLATED_PAGE, trueFalse(outcome.pageIsolated)),
            row(COPY.ISOLATED_WORKER, trueFalse(outcome.workerIsolated)),
          ],
        };
      }
      const report = reportRows(outcome.report);
      return {
        statusLine: COPY.INVALID_RUN_FINISHED,
        detailLine: null,
        rows: [...stages, ...report.rows],
        rawErrorMessage: report.rawErrorMessage,
        rawProofErrorMessage: report.rawProofErrorMessage,
      };
    }
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

/**
 * The plain data the page turns into DOM text. Everything except `rawErrorMessage` and
 * `rawProofErrorMessage` and the values of `quoted` rows comes from `COPY`, the stage names and
 * numbers, so it is uppercase.
 */
export function render(state: ViewState): ViewModel {
  const parts = body(state);
  return {
    title: COPY.TITLE,
    demoLabel: COPY.DEMO_LABEL,
    runLabel: COPY.RUN,
    invalidWitnessLabel: COPY.INVALID_WITNESS,
    statusLine: parts.statusLine,
    detailLine: parts.detailLine,
    controlsDisabled: controlsDisabled(state),
    rows: parts.rows,
    rawErrorMessage: parts.rawErrorMessage,
    rawErrorLabel: COPY.ERROR_MESSAGE,
    rawProofErrorMessage: parts.rawProofErrorMessage,
    rawProofErrorLabel: COPY.PROOF_ERROR_MESSAGE,
  };
}
