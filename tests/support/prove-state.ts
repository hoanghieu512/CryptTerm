// Pure state builders for the CTM300 tests (terminal-ui design, sections F and G). They go
// through the real model where the flow is simple (CTM000 to CTM300) and set plain data where a
// test needs a state that the flow cannot reach cheaply (a `done` bundle, a malformed batch).
import type { Batch } from '../../src/ledger/batch';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { MESSAGES } from '../../src/ui/model/messages';
import { renderGrid } from '../../src/ui/model/grid';
import { verifyLinkFor } from '../../src/ui/model/links';
import { update } from '../../src/ui/model/update';
import type { Effect, TerminalState } from '../../src/ui/model/types';
import { sentinelBatch } from './prove-fixtures';
import { pf, stateOn } from './terminal-arbitraries';

/** Two postings, one debit and one credit of 1.00, both within the limit. Passes `checkBatch`. */
export const GOOD_BATCH: Batch = sentinelBatch();

/** CTM300 reached through the real flow (CTM000, CTM100, load, CTM200, Enter). */
export function ctm300(batch: Batch = GOOD_BATCH): TerminalState {
  return stateOn('CTM300', batch);
}

/** The limit field text set directly, as if typed. */
export function withLimitText(state: TerminalState, text: string): TerminalState {
  return { ...state, fields: { ...state.fields, limit: text } };
}

/** Replaces the loaded batch, for batches that the flow could not produce (malformed postings). */
export function withBatch(state: TerminalState, batch: Batch): TerminalState {
  if (state.sample === null) throw new Error('FIXTURE: NO SAMPLE');
  return { ...state, sample: { ...state.sample, batch } };
}

/** A `done` prove state for `bundle`, built from the same functions the model must use. */
export function withDone(state: TerminalState, bundle: ProofBundle): TerminalState {
  return {
    ...state,
    status: MESSAGES.DONE,
    prove: { kind: 'done', bundle, json: bundleToJson(bundle), link: verifyLinkFor(bundle) },
  };
}

/** Rendered rows of a state. */
export function rowsOf(state: TerminalState): string[] {
  return renderGrid(state);
}

/** PF5 through `update`. */
export function pressProve(state: TerminalState): { state: TerminalState; effects: readonly Effect[] } {
  return update(state, pf(5));
}

/** The `PROVE` effects among `effects`. */
export function proveEffects(effects: readonly Effect[]): Extract<Effect, { type: 'PROVE' }>[] {
  return effects.filter((e): e is Extract<Effect, { type: 'PROVE' }> => e.type === 'PROVE');
}

/** Digits planted in rejected values. No rendered row may contain them. */
export const PLANT = 'S3NT1N3L918273645';
