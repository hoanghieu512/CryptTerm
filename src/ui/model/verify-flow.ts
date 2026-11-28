// CTM900 verify flow (verifier design, "Pure flow"). Pure: every function maps a state to an
// Update. Effects are data; the host (terminal.ts) runs them.
//
// This file holds the input side of the screen (the bundle text from a paste or a dropped file,
// PF3) and the run: Enter starts one verifier call, and the result is mapped, fail closed, to a
// count of passed steps. Only that count reaches the screen, never the report itself.
//
// The bundle text is held in exactly one field, `verify.bundleText`. It is never drawn and never
// copied into a message. `bundleSeq` is a number that changes with every replacement, so a run can
// compare versions without a second copy of the text.
import { MAX_INPUT_CHARS } from '../../zk/bundle';
import { parseAmountInput } from './amount-input';
import { MESSAGES } from './messages';
import { limitRefused } from './prove-flow';
import { NOT_COMPLETED_DETAIL } from '../../zk/verifier';
import type { VerifyStepName } from '../../zk/verifier';
import type { DroppedFile, SystemAction, TerminalState, Update, VerifyOutcome, VerifyState } from './types';

export const EMPTY_VERIFY: VerifyState = Object.freeze({
  bundleText: '',
  source: 'NONE',
  bundleSeq: 0,
  pendingRead: null,
  run: null,
  result: null,
});

function stay(state: TerminalState, status?: string): Update {
  return { state: status === undefined ? state : { ...state, status }, effects: [] };
}

/** The six steps in the order the verifier runs them. A test pins it to the keys of VERIFY_DETAILS. */
export const VERIFY_STEP_ORDER: readonly VerifyStepName[] = Object.freeze([
  'FORMAT',
  'SIGNATURE',
  'DIGEST_MATCH',
  'POLICY',
  'CIRCUIT',
  'PROOF',
] as const);

/**
 * Enter on CTM900. While a run is active the answer is VERIFY IN PROGRESS and no second call is
 * made. A refused limit text ends in the matching message. An accepted one starts one run.
 */
export function startVerify(state: TerminalState, values: Readonly<Record<string, string>>): Update {
  if (state.verify.run !== null) return stay(state, MESSAGES.VERIFY_IN_PROGRESS);
  const limitText = values['limit'] ?? '';
  const limit = parseAmountInput(limitText);
  if (!limit.ok) return limitRefused(state, limit.error);
  const runId = state.nextRunId;
  return {
    state: {
      ...state,
      status: MESSAGES.VERIFYING,
      nextRunId: runId + 1,
      verify: { ...state.verify, run: { runId, limitText, bundleSeq: state.verify.bundleSeq }, result: null },
    },
    effects: [{ type: 'VERIFY', runId, text: state.verify.bundleText, limitCents: limit.value }],
  };
}

/** The Bundle_Text is replaced: new text, new source, a new version, and no older read pending. */
function withBundle(state: TerminalState, text: string, source: 'PASTE' | 'FILE'): Update {
  return {
    state: {
      ...state,
      verify: { ...state.verify, bundleText: text, source, bundleSeq: state.verify.bundleSeq + 1, pendingRead: null },
      status: MESSAGES.BUNDLE_READY,
    },
    effects: [],
  };
}

/** PASTE_TEXT. Ignored off CTM900 and for text that is not a non-empty string. */
export function onPasteText(state: TerminalState, action: Extract<SystemAction, { type: 'PASTE_TEXT' }>): Update {
  if (state.screen !== 'CTM900') return stay(state);
  const text: unknown = action.text;
  if (typeof text !== 'string' || text.length === 0) return stay(state);
  return withBundle(state, text, 'PASTE');
}

/** True for a size in bytes that may be read: a non-negative safe integer within the limit. */
function sizeAccepted(size: unknown): boolean {
  return typeof size === 'number' && Number.isSafeInteger(size) && size >= 0 && size <= MAX_INPUT_CHARS;
}

/**
 * FILES_DROPPED. The checks run in this order and the first failure ends the function: exactly one
 * file, a name ending in `.json` in any letter case, then the size in bytes from `file.size`. A
 * refused drop changes only the status line. The model never calls `file.text()`.
 */
export function onFilesDropped(state: TerminalState, action: Extract<SystemAction, { type: 'FILES_DROPPED' }>): Update {
  if (state.screen !== 'CTM900') return stay(state);
  const files: unknown = action.files;
  const only: DroppedFile | undefined = Array.isArray(files) && files.length === 1 ? (files[0] as DroppedFile) : undefined;
  const name: unknown = only?.name;
  if (only === undefined || typeof name !== 'string' || !name.toLowerCase().endsWith('.json')) {
    return stay(state, MESSAGES.DROP_ONE_JSON);
  }
  if (!sizeAccepted(only.size)) return stay(state, MESSAGES.FILE_TOO_LARGE);
  const readId = state.nextLoadId;
  return {
    state: { ...state, nextLoadId: readId + 1, verify: { ...state.verify, pendingRead: readId } },
    effects: [{ type: 'READ_FILE', readId, file: only }],
  };
}

/** The read result is current only on CTM900 with a matching pending read id. */
function isCurrentRead(state: TerminalState, readId: number): boolean {
  return state.screen === 'CTM900' && state.verify.pendingRead !== null && state.verify.pendingRead === readId;
}

/** FILE_READ. A result of an older read, or after a newer paste or drop, is dropped. */
export function onFileRead(state: TerminalState, action: Extract<SystemAction, { type: 'FILE_READ' }>): Update {
  if (!isCurrentRead(state, action.readId)) return stay(state);
  const text: unknown = action.text;
  if (typeof text !== 'string') return onFileReadFailed(state, { type: 'FILE_READ_FAILED', readId: action.readId });
  return withBundle(state, text, 'FILE');
}

/** FILE_READ_FAILED. Clears the pending read when current. The text and source are kept. */
export function onFileReadFailed(state: TerminalState, action: Extract<SystemAction, { type: 'FILE_READ_FAILED' }>): Update {
  if (!isCurrentRead(state, action.readId)) return stay(state);
  return { state: { ...state, verify: { ...state.verify, pendingRead: null }, status: MESSAGES.FILE_READ_FAILED }, effects: [] };
}

/** PF3 on CTM900: a plain page navigation to the logon route. The state does not change. */
export function leaveVerify(state: TerminalState): Update {
  return { state, effects: [{ type: 'NAVIGATE', href: '/' }] };
}

/**
 * The fail-closed gate. Returns the number of passed steps (0 to 6) for a well-formed report and
 * `null` for anything else, a getter that throws included. A well-formed report has a verdict of
 * VERIFIED or REJECTED and 1 to 6 steps. Step i is named VERIFY_STEP_ORDER[i] and has a boolean
 * `ok`. A VERIFIED report has six passing steps. A REJECTED report has passing steps and then one
 * failing last step. The `detail` of a step is never read, with one exception: a REJECTED report
 * whose last step is PROOF with `detail === NOT_COMPLETED_DETAIL` (the proof check did not finish)
 * gives `null`, so the screen shows the verifier error and not REJECTED AT PROOF. The text is only
 * compared with `===`. It is never copied or shown.
 */
export function normalizeReport(report: unknown): number | null {
  try {
    if (typeof report !== 'object' || report === null) return null;
    const { verdict, steps } = report as { readonly verdict?: unknown; readonly steps?: unknown };
    if (verdict !== 'VERIFIED' && verdict !== 'REJECTED') return null;
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > VERIFY_STEP_ORDER.length) return null;
    const last = steps.length - 1;
    for (let i = 0; i <= last; i += 1) {
      const step: unknown = steps[i];
      if (typeof step !== 'object' || step === null) return null;
      const { name, ok } = step as { readonly name?: unknown; readonly ok?: unknown };
      if (name !== VERIFY_STEP_ORDER[i] || typeof ok !== 'boolean') return null;
      const mustPass = i < last || verdict === 'VERIFIED';
      if (ok !== mustPass) return null;
    }
    if (verdict === 'VERIFIED') return steps.length === VERIFY_STEP_ORDER.length ? steps.length : null;
    const lastStep = steps[last] as { readonly name?: unknown; readonly detail?: unknown };
    if (lastStep.name === 'PROOF' && lastStep.detail === NOT_COMPLETED_DETAIL) return null;
    return last;
  } catch {
    return null;
  }
}

/** The run-id drop. True only on CTM900, for the run that is active. */
function isCurrentVerify(state: TerminalState, runId: number): boolean {
  return state.screen === 'CTM900' && state.verify.run !== null && state.verify.run.runId === runId;
}

/** A settled run. `passed` is null for an error. A result for changed input is not stored. */
function settleRun(state: TerminalState, passed: number | null, keyId: string | null): Update {
  const run = state.verify.run;
  if (run === null) return stay(state);
  const ended = { ...state.verify, run: null };
  if (run.bundleSeq !== state.verify.bundleSeq || run.limitText !== (state.fields.limit ?? '')) {
    return { state: { ...state, verify: ended, status: MESSAGES.INPUT_CHANGED }, effects: [] };
  }
  // A key id can never show for a failed or skipped SIGNATURE step: it is kept for passed >= 2 only.
  const outcome: VerifyOutcome =
    passed === null
      ? { kind: 'error' }
      : { kind: 'report', passed, keyId: passed >= 2 && typeof keyId === 'string' ? keyId : null };
  return {
    state: {
      ...state,
      verify: { ...ended, result: { outcome, limitText: run.limitText, bundleSeq: run.bundleSeq } },
      status: passed === null ? MESSAGES.VERIFIER_ERROR : MESSAGES.VERIFY_DONE,
    },
    effects: [],
  };
}

/** VERIFY_DONE. A result with another run id is dropped: the same state object comes back. */
export function onVerifyDone(state: TerminalState, action: Extract<SystemAction, { type: 'VERIFY_DONE' }>): Update {
  if (!isCurrentVerify(state, action.runId)) return stay(state);
  return settleRun(state, normalizeReport(action.report), action.keyId);
}

/** VERIFY_FAILED: a rejection or a throw ends in the same error outcome as a malformed report. */
export function onVerifyFailed(state: TerminalState, action: Extract<SystemAction, { type: 'VERIFY_FAILED' }>): Update {
  if (!isCurrentVerify(state, action.runId)) return stay(state);
  return settleRun(state, null, null);
}

/**
 * What the layout may draw: the stored outcome, only while it still belongs to the input on screen.
 * Editing the limit or replacing the bundle hides it at once. Derived, so it adds no state.
 */
export function verifyShown(state: TerminalState): VerifyOutcome | null {
  const result = state.verify.result;
  if (result === null) return null;
  return result.limitText === (state.fields.limit ?? '') && result.bundleSeq === state.verify.bundleSeq
    ? result.outcome
    : null;
}
