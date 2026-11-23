// The terminal state machine: update(state, action) -> { state, effects } (terminal-ui design,
// section A). Pure: no React, DOM or network. No effect is emitted for the prove flow yet; the
// only effect so far is LOAD_SAMPLE from CTM100.
import { inputFields } from './grid';
import { MESSAGES } from './messages';
import { goTo } from './navigation';
import { SCREENS, layoutOf } from './screens/index';
import type { Action, PfNumber, TerminalState, Update } from './types';

export function initialState(): TerminalState {
  return {
    screen: 'CTM000',
    fields: {},
    cursor: null,
    status: '',
    sample: null,
    edits: new Map(),
    tamper: false,
    page: 0,
    pendingLoad: null,
    prove: { kind: 'idle' },
    nextLoadId: 1,
    nextRunId: 1,
  };
}

function textOf(state: TerminalState, id: string): string {
  return (state.fields as Readonly<Record<string, string | undefined>>)[id] ?? '';
}

/**
 * Repairs the cursor after an update: it must name an input field of the layout, with an offset
 * inside the field text. Returns the same object when nothing needs repair.
 */
export function settle(state: TerminalState): TerminalState {
  const inputs = inputFields(state);
  const first = inputs[0];
  if (first === undefined) return state.cursor === null ? state : { ...state, cursor: null };
  const cursor = state.cursor;
  if (cursor !== null && inputs.some((f) => f.id === cursor.fieldId)) {
    const max = textOf(state, cursor.fieldId).length;
    if (cursor.offset >= 0 && cursor.offset <= max) return state;
    return { ...state, cursor: { fieldId: cursor.fieldId, offset: Math.min(Math.max(cursor.offset, 0), max) } };
  }
  return { ...state, cursor: { fieldId: first.id, offset: 0 } };
}

function isPrintable(ch: string): boolean {
  return ch.length === 1 && ch >= ' ' && ch <= '~';
}

function typeChar(state: TerminalState, ch: string): TerminalState {
  const cursor = state.cursor;
  if (cursor === null || !isPrintable(ch)) return state;
  const field = inputFields(state).find((f) => f.id === cursor.fieldId);
  if (field === undefined) return state;
  const value = textOf(state, field.id);
  const offset = Math.min(cursor.offset, value.length);
  let next: string;
  if (offset < value.length) next = `${value.slice(0, offset)}${ch}${value.slice(offset + 1)}`;
  else if (value.length < field.length) next = `${value}${ch}`;
  else return state;
  return { ...state, fields: { ...state.fields, [field.id]: next }, cursor: { fieldId: field.id, offset: offset + 1 } };
}

function backspace(state: TerminalState): TerminalState {
  const cursor = state.cursor;
  if (cursor === null || cursor.offset <= 0) return state;
  const value = textOf(state, cursor.fieldId);
  const offset = Math.min(cursor.offset, value.length);
  if (offset <= 0) return state;
  const next = `${value.slice(0, offset - 1)}${value.slice(offset)}`;
  return {
    ...state,
    fields: { ...state.fields, [cursor.fieldId]: next },
    cursor: { fieldId: cursor.fieldId, offset: offset - 1 },
  };
}

function tab(state: TerminalState, back: boolean): TerminalState {
  const inputs = inputFields(state);
  const k = inputs.length;
  if (k === 0) return state;
  const at = inputs.findIndex((f) => f.id === state.cursor?.fieldId);
  const index = at < 0 ? (back ? k - 1 : 0) : (at + (back ? k - 1 : 1)) % k;
  const target = inputs[index];
  if (target === undefined) return state;
  return { ...state, cursor: { fieldId: target.id, offset: textOf(state, target.id).length } };
}

function runPf(state: TerminalState, pf: PfNumber): Update {
  const entry = layoutOf(state).pf.find((e) => e.pf === pf);
  if (entry === undefined) return { state: { ...state, status: MESSAGES.PF_INACTIVE }, effects: [] };
  return entry.run(state);
}

function enter(state: TerminalState): Update {
  const values: Record<string, string> = {};
  for (const f of inputFields(state)) values[f.id] = textOf(state, f.id);
  return SCREENS[state.screen].submit(state, values);
}

/** The pending load result is current only on CTM100 with a matching load id. */
function isCurrentLoad(state: TerminalState, loadId: number): boolean {
  return state.screen === 'CTM100' && state.pendingLoad !== null && state.pendingLoad === loadId;
}

function reduce(state: TerminalState, action: Action): Update {
  switch (action.type) {
    case 'PF':
      return runPf(state, action.pf);
    case 'ENTER':
      return enter(state);
    case 'TAB':
      return { state: tab(state, action.back), effects: [] };
    case 'BACKSPACE':
      return { state: backspace(state), effects: [] };
    case 'CHAR':
      return { state: typeChar(state, action.ch), effects: [] };
    case 'SAMPLE_LOADED':
      if (!isCurrentLoad(state, action.loadId)) return { state, effects: [] };
      return {
        state: { ...goTo(state, 'CTM200'), sample: action.sample, status: MESSAGES.SAMPLE_LOADED },
        effects: [],
      };
    case 'SAMPLE_FAILED':
      if (!isCurrentLoad(state, action.loadId)) return { state, effects: [] };
      return { state: { ...state, pendingLoad: null, status: MESSAGES.LOAD_FAILED }, effects: [] };
    case 'PROVE_PROGRESS':
    case 'PROVE_DONE':
    case 'PROVE_FAILED':
    case 'CLIPBOARD_DONE':
      // Handled with the prove flow (group 3). Until then no run exists, so every result is stale.
      return { state, effects: [] };
  }
}

export function update(state: TerminalState, action: Action): Update {
  const result = reduce(state, action);
  const settled = settle(result.state);
  return settled === result.state ? result : { state: settled, effects: result.effects };
}
