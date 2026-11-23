// Screen moves (terminal-ui design, "Screen flow"). `goTo` is the only code that changes `screen`.
// It applies the keep and discard rules and leaves `status` empty and the cursor null: the caller
// sets the status, and `settle` in `update.ts` puts the cursor on the first input field.
//
//   to CTM000   nothing is kept (a pending load is dropped)
//   to CTM100   sample, edits, tamper flag, page and prove are discarded
//   to CTM200   from CTM100: fresh view (the caller sets `sample`)
//               from CTM300: sample, edits and page kept, a run or a failure is dropped, a bundle kept
//   to CTM300   sample, edits and page kept, tamper mode off, limit field prefilled
import { LIMIT_CENTS } from '../../ledger/invariants';
import type { ScreenId, TerminalState } from './types';

export function goTo(state: TerminalState, screen: ScreenId): TerminalState {
  const moved: TerminalState = { ...state, screen, fields: {}, cursor: null, status: '' };
  switch (screen) {
    case 'CTM000':
      return { ...moved, pendingLoad: null };
    case 'CTM100':
      return {
        ...moved,
        sample: null,
        edits: new Map(),
        tamper: false,
        page: 0,
        pendingLoad: null,
        prove: { kind: 'idle' },
      };
    case 'CTM200':
      if (state.screen === 'CTM300') {
        const keep = state.prove.kind === 'done' ? state.prove : ({ kind: 'idle' } as const);
        return { ...moved, tamper: false, pendingLoad: null, prove: keep };
      }
      return { ...moved, edits: new Map(), tamper: false, page: 0, pendingLoad: null, prove: { kind: 'idle' } };
    case 'CTM300':
      // The policy limit field starts from the default on every entry. A typed limit is not kept.
      return { ...moved, fields: { limit: LIMIT_CENTS.toString() }, tamper: false, pendingLoad: null };
  }
}
