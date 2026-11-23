// Tamper helpers (terminal-ui design, sections A and G). Pure. The Working_Batch is derived from
// the loaded sample and the edit map, never stored. Nothing here creates, replaces or reads for
// writing a SignedDigest: the Original_Digest stays as loaded.
import type { Batch } from '../../ledger/batch';
import type { Cents } from '../../ledger/posting';
import { AMOUNT_INPUT_MESSAGES, parseAmountInput } from './amount-input';
import { MESSAGES } from './messages';
import type { FieldId, LoadedSample, TerminalState, Update } from './types';

/** Postings per CTM200 page. */
export const PAGE_SIZE = 12;

/** The sample's postings with each edited slot's amount replaced. Every other field is kept. */
export function workingBatch(sample: LoadedSample, edits: ReadonlyMap<number, Cents>): Batch {
  return {
    batchId: sample.batch.batchId,
    postings: sample.batch.postings.map((p, slot) => {
      const amountCents = edits.get(slot);
      return amountCents === undefined ? p : { ...p, amountCents };
    }),
  };
}

/** True while the Working_Batch differs from the loaded batch. `edits` only holds differing slots. */
export function isTampered(state: TerminalState): boolean {
  return state.edits.size > 0;
}

/** Number of CTM200 pages for a batch of `postingCount` postings (at least 1). */
export function pageCountFor(postingCount: number): number {
  return Math.max(1, Math.ceil(postingCount / PAGE_SIZE));
}

/** The 0-based slots shown on the current page of CTM200. */
export function pageSlots(state: TerminalState): readonly number[] {
  if (state.sample === null) return [];
  const first = state.page * PAGE_SIZE;
  const end = Math.min(state.sample.batch.postings.length, first + PAGE_SIZE);
  const slots: number[] = [];
  for (let slot = first; slot < end; slot += 1) slots.push(slot);
  return slots;
}

function amountFieldId(slot: number): FieldId {
  return `amt:${slot}`;
}

function sameEdits(a: ReadonlyMap<number, Cents>, b: ReadonlyMap<number, Cents>): boolean {
  if (a.size !== b.size) return false;
  for (const [slot, cents] of a) if (b.get(slot) !== cents) return false;
  return true;
}

/**
 * Enter in Tamper_Mode. Every non-empty `amt:<slot>` text of the current page is parsed first. If
 * any fails, nothing is applied (the edit map, the other fields and the prove state stay as they
 * were), the status is the fixed message and the cursor goes to the first failing field. Empty
 * text means "no change" for that slot. An amount equal to the sample's removes the edit.
 */
export function applyAmountEdits(state: TerminalState, values: Readonly<Record<string, string>>): Update {
  const sample = state.sample;
  if (sample === null) return { state, effects: [] };
  const slots = pageSlots(state);
  const typed = slots.flatMap((slot) => {
    const text = values[amountFieldId(slot)] ?? '';
    return text === '' ? [] : [{ slot, text }];
  });
  if (typed.length === 0) return { state: { ...state, status: MESSAGES.NO_EDITS }, effects: [] };

  const parsed: { slot: number; value: Cents }[] = [];
  for (const { slot, text } of typed) {
    const result = parseAmountInput(text);
    if (!result.ok) {
      return {
        state: {
          ...state,
          status: AMOUNT_INPUT_MESSAGES[result.error],
          cursor: { fieldId: amountFieldId(slot), offset: text.length },
        },
        effects: [],
      };
    }
    parsed.push({ slot, value: result.value });
  }

  const edits = new Map(state.edits);
  for (const { slot, value } of parsed) {
    if (sample.batch.postings[slot]?.amountCents === value) edits.delete(slot);
    else edits.set(slot, value);
  }
  const fields: Record<string, string | undefined> = { ...state.fields };
  for (const slot of slots) delete fields[amountFieldId(slot)];
  return {
    state: {
      ...state,
      edits,
      fields,
      status: MESSAGES.EDITS_APPLIED,
      // A bundle belongs to one batch. A changed edit map drops it (Requirement 8.6).
      prove: sameEdits(edits, state.edits) ? state.prove : { kind: 'idle' },
    },
    effects: [],
  };
}
