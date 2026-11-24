// CTM900 verify flow (verifier design, "Pure flow"). Pure: every function maps a state to an
// Update. Effects are data; the host (terminal.ts) runs them.
//
// This file holds the input side of the screen: the bundle text from a paste or a dropped file,
// the refusal of a bad limit, and PF3. The run itself (the verifier call and its result) is added
// by task 2.2, so an accepted limit returns the state unchanged here.
//
// The bundle text is held in exactly one field, `verify.bundleText`. It is never drawn and never
// copied into a message. `bundleSeq` is a number that changes with every replacement, so a run can
// compare versions without a second copy of the text.
import { MAX_INPUT_CHARS } from '../../zk/bundle';
import { parseAmountInput } from './amount-input';
import { MESSAGES } from './messages';
import { limitRefused } from './prove-flow';
import type { DroppedFile, SystemAction, TerminalState, Update, VerifyState } from './types';

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

/** Enter on CTM900. A refused limit text ends here. An accepted one is completed by task 2.2. */
export function startVerify(state: TerminalState, values: Readonly<Record<string, string>>): Update {
  const limit = parseAmountInput(values['limit'] ?? '');
  if (!limit.ok) return limitRefused(state, limit.error);
  return { state, effects: [] };
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
