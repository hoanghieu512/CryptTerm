// CTM300 prove flow (terminal-ui design, section F). Pure: every function maps a state to an
// Update. Effects are data; the host (terminal.ts) runs them.
//
// Run ids. `isCurrentRun` is the only test of "this result belongs to the run on screen". Every
// system action of a run (progress, done, failed) goes through it first, and a result that fails
// it is dropped: the same state object comes back, with no effects. A run is current only on
// CTM300, with prove.kind 'proving' and a matching run id.
//
// CANCEL_PROVE. `leaveProve` is the only function in the model that emits it.
import { checkBatch } from '../../ledger/check-batch';
import { bundleToJson } from '../../zk/bundle';
import { PROVE_ERROR_MESSAGES } from '../../zk/prove-service';
import { PROVE_STAGES } from '../../zk/worker-protocol';
import type { ProveStage } from '../../zk/worker-protocol';
import type { Batch } from '../../ledger/batch';
import { AMOUNT_INPUT_MESSAGES, parseAmountInput } from './amount-input';
import { bundleFileName, verifyLinkFor } from './links';
import { MESSAGES } from './messages';
import { goTo } from './navigation';
import { workingBatch } from './tamper';
import type { LoadedSample, SystemAction, TerminalState, Update } from './types';

type ProvingState = TerminalState & { readonly prove: Extract<TerminalState['prove'], { kind: 'proving' }> };
type DoneState = TerminalState & { readonly prove: Extract<TerminalState['prove'], { kind: 'done' }> };

function stay(state: TerminalState, status?: string): Update {
  return { state: status === undefined ? state : { ...state, status }, effects: [] };
}

/** The run-id drop. True only on CTM300, while proving, for the run that is on screen. */
export function isCurrentRun(state: TerminalState, runId: number): state is ProvingState {
  return state.screen === 'CTM300' && state.prove.kind === 'proving' && state.prove.runId === runId;
}

function isDone(state: TerminalState): state is DoneState {
  return state.screen === 'CTM300' && state.prove.kind === 'done';
}

/** The sample with its edits. A batch whose postings are not an array is returned as loaded. */
export function workingBatchOf(sample: LoadedSample, edits: TerminalState['edits']): Batch {
  const postings: unknown = sample.batch.postings;
  return Array.isArray(postings) ? workingBatch(sample, edits) : sample.batch;
}

/** Text of the limit field, or the empty text. */
function limitText(state: TerminalState): string {
  return state.fields.limit ?? '';
}

function limitRefused(state: TerminalState, error: keyof typeof AMOUNT_INPUT_MESSAGES): Update {
  return {
    state: {
      ...state,
      status: AMOUNT_INPUT_MESSAGES[error],
      cursor: { fieldId: 'limit', offset: limitText(state).length },
    },
    effects: [],
  };
}

/** Enter on CTM300: validate the limit field only. No run starts. */
export function checkLimitField(state: TerminalState, values: Readonly<Record<string, string>>): Update {
  const parsed = parseAmountInput(values['limit'] ?? '');
  if (!parsed.ok) return limitRefused(state, parsed.error);
  return stay(state, MESSAGES.LIMIT_OK);
}

/** PF5. Single run, limit rule, on-page checkBatch, then one PROVE effect with a fresh run id. */
export function startProve(state: TerminalState): Update {
  if (state.prove.kind === 'proving') return stay(state, MESSAGES.IN_PROGRESS);
  const sample = state.sample;
  if (sample === null) return stay(state, MESSAGES.PF_INACTIVE);
  const limit = parseAmountInput(limitText(state));
  if (!limit.ok) return limitRefused(state, limit.error);

  const working = workingBatchOf(sample, state.edits);
  const checked = checkBatch(working, limit.value);
  if (!checked.ok) {
    const message = `${MESSAGES.REJECTED}${checked.reason}`;
    return { state: { ...state, prove: { kind: 'failed', message }, status: message }, effects: [] };
  }
  const runId = state.nextRunId;
  const stage: ProveStage = 'PRECHECK';
  return {
    state: {
      ...state,
      nextRunId: runId + 1,
      prove: { kind: 'proving', runId, stage },
      status: `${MESSAGES.PROVING}${stage}`,
    },
    effects: [{ type: 'PROVE', runId, batch: working, digest: sample.digest, limitCents: limit.value }],
  };
}

export function onProveProgress(state: TerminalState, action: Extract<SystemAction, { type: 'PROVE_PROGRESS' }>): Update {
  if (!isCurrentRun(state, action.runId)) return stay(state);
  const stage = PROVE_STAGES.find((s) => s === action.stage);
  if (stage === undefined) return stay(state);
  return {
    state: { ...state, prove: { kind: 'proving', runId: action.runId, stage }, status: `${MESSAGES.PROVING}${stage}` },
    effects: [],
  };
}

export function onProveDone(state: TerminalState, action: Extract<SystemAction, { type: 'PROVE_DONE' }>): Update {
  if (!isCurrentRun(state, action.runId)) return stay(state);
  try {
    const json = bundleToJson(action.bundle);
    const link = verifyLinkFor(action.bundle);
    return {
      state: { ...state, prove: { kind: 'done', bundle: action.bundle, json, link }, status: MESSAGES.DONE },
      effects: [],
    };
  } catch {
    const message = PROVE_ERROR_MESSAGES.PROVER_FAILED;
    return { state: { ...state, prove: { kind: 'failed', message }, status: message }, effects: [] };
  }
}

export function onProveFailed(state: TerminalState, action: Extract<SystemAction, { type: 'PROVE_FAILED' }>): Update {
  if (!isCurrentRun(state, action.runId)) return stay(state);
  const reason: unknown = action.reason;
  const message =
    typeof reason === 'string' && Object.hasOwn(PROVE_ERROR_MESSAGES, reason)
      ? PROVE_ERROR_MESSAGES[reason as keyof typeof PROVE_ERROR_MESSAGES]
      : MESSAGES.UNEXPECTED;
  return { state: { ...state, prove: { kind: 'failed', message }, status: message }, effects: [] };
}

/**
 * PF3 on CTM300. While a run is on screen this is the one place that emits CANCEL_PROVE. The
 * state is cleared at once (goTo drops the run), so the run's later result is a stale run id.
 */
export function leaveProve(state: TerminalState): Update {
  const cancel = state.prove.kind === 'proving';
  return { state: goTo(state, 'CTM200'), effects: cancel ? [{ type: 'CANCEL_PROVE' }] : [] };
}

// Export helpers. Each needs a bundle on screen, so a key without one never reaches them: the
// PF entries exist only while prove.kind is 'done'.

/** PF9: the bundle text goes to the clipboard. The status changes when CLIPBOARD_DONE arrives. */
export function copyBundle(state: TerminalState): Update {
  if (!isDone(state)) return stay(state, MESSAGES.PF_INACTIVE);
  return { state, effects: [{ type: 'CLIPBOARD_WRITE', text: state.prove.json }] };
}

/** PF10: the bundle text goes to a file named after the batch id. */
export function saveBundle(state: TerminalState): Update {
  if (!isDone(state)) return stay(state, MESSAGES.PF_INACTIVE);
  const { bundle, json } = state.prove;
  return {
    state: { ...state, status: MESSAGES.DOWNLOAD },
    effects: [{ type: 'DOWNLOAD', filename: bundleFileName(bundle), text: json }],
  };
}

/** PF11: the verify link is handed to the host. */
export function openVerifier(state: TerminalState): Update {
  if (!isDone(state)) return stay(state, MESSAGES.PF_INACTIVE);
  return { state: { ...state, status: MESSAGES.OPENING }, effects: [{ type: 'OPEN_LINK', href: state.prove.link }] };
}

/** CLIPBOARD_DONE. Dropped unless a bundle is on screen. The bundle stays in both cases. */
export function onClipboardDone(state: TerminalState, action: Extract<SystemAction, { type: 'CLIPBOARD_DONE' }>): Update {
  if (!isDone(state)) return stay(state);
  return stay(state, action.ok ? MESSAGES.COPIED : MESSAGES.COPY_FAILED);
}
