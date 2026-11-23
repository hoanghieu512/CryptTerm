// CTM200 BATCH VIEW (terminal-ui design, sections B and G): batch id, count and page, the digest
// status of the ORIGINAL batch, up to 12 postings with masked accounts, the totals of the
// Working_Batch, and Tamper_Mode (PF12) with one amount field per posting row.
//
// This is the only file under `src/ui` that reads `posting.account`, and only through
// `maskAccount`. The digest status row never changes text after an edit: TAMPERED is added on the
// same row. No text here says that the Working_Batch matches the signed root.
import { FLAG_NO_LETTER, FLAG_YES_LETTER, SIDE_CREDIT_LETTER, SIDE_DEBIT_LETTER } from '../../../ledger/layout';
import { maskAccount } from '../../../ledger/mask';
import { FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from '../../../ledger/posting';
import type { Cents } from '../../../ledger/posting';
import { formatCents } from '../amount-input';
import { MESSAGES } from '../messages';
import { goTo } from '../navigation';
import { applyAmountEdits, isTampered, pageCountFor, pageSlots, workingBatch } from '../tamper';
import type { Field, PfEntry, ScreenDef, ScreenLayout, TerminalState, Update } from '../types';
import { headerFields, inputField, textField } from './common';

const INFO_ROW = 2;
const DIGEST_ROW = 3;
const HEADING_ROW = 5;
const FIRST_POSTING_ROW = 6;
const TOTALS_ROW = 19;
const HINT_ROW = 21;
const ENTER_ROW = 22;
const TAMPERED_COL = 40;
const EDIT_COL = 67;
const EDIT_LENGTH = 13;
const VALID_TEXT = 'SIGNATURE VALID (ORIGINAL BATCH)';
const INVALID_TEXT = 'SIGNATURE INVALID (ORIGINAL BATCH)';

function pageMove(delta: 1 | -1): (state: TerminalState) => Update {
  return (state) => {
    const last = pageCountFor(state.sample?.batch.postings.length ?? 0) - 1;
    const target = state.page + delta;
    if (target < 0) return { state: { ...state, status: MESSAGES.FIRST_PAGE }, effects: [] };
    if (target > last) return { state: { ...state, status: MESSAGES.LAST_PAGE }, effects: [] };
    // Typed text belongs to the page it was typed on.
    return { state: { ...state, page: target, fields: {}, cursor: null, status: '' }, effects: [] };
  };
}

function toggleTamper(state: TerminalState): Update {
  const tamper = !state.tamper;
  return {
    state: { ...state, tamper, fields: {}, cursor: null, status: tamper ? MESSAGES.TAMPER_ON : MESSAGES.TAMPER_OFF },
    effects: [],
  };
}

function totals(postings: readonly { readonly side: bigint; readonly amountCents: Cents }[]): { debit: Cents; credit: Cents } {
  let debit = 0n;
  let credit = 0n;
  for (const p of postings) {
    if (p.side === SIDE_DEBIT) debit += p.amountCents;
    else if (p.side === SIDE_CREDIT) credit += p.amountCents;
  }
  return { debit, credit };
}

function bodyFields(state: TerminalState): Field[] {
  const sample = state.sample;
  if (sample === null) return [];
  const working = workingBatch(sample, state.edits);
  const count = working.postings.length;
  const pages = pageCountFor(count);
  const fields: Field[] = [
    textField(INFO_ROW, 1, `BATCH ${working.batchId}`),
    textField(INFO_ROW, 26, `COUNT ${count}`),
    textField(INFO_ROW, 66, `PAGE ${state.page + 1}/${pages}`),
    textField(DIGEST_ROW, 1, sample.signatureValid ? VALID_TEXT : INVALID_TEXT),
  ];
  if (isTampered(state)) fields.push(textField(DIGEST_ROW, TAMPERED_COL, 'TAMPERED'));
  fields.push(
    textField(HEADING_ROW, 1, 'NO'),
    textField(HEADING_ROW, 16, 'RECORD ID'),
    textField(HEADING_ROW, 26, 'ACCOUNT'),
    textField(HEADING_ROW, 47, 'S'),
    textField(HEADING_ROW, 57, 'AMOUNT'),
    textField(HEADING_ROW, 64, 'F'),
  );
  if (state.tamper) fields.push(textField(HEADING_ROW, EDIT_COL, 'NEW CENTS'));
  pageSlots(state).forEach((slot, k) => {
    const p = working.postings[slot];
    if (p === undefined) return;
    const row = FIRST_POSTING_ROW + k;
    fields.push(
      textField(row, 1, String(slot + 1).padStart(3)),
      textField(row, 5, p.recordId.toString().padStart(20)),
      textField(row, 26, maskAccount(p.account)),
      textField(row, 47, p.side === SIDE_DEBIT ? SIDE_DEBIT_LETTER : SIDE_CREDIT_LETTER),
      textField(row, 49, formatCents(p.amountCents).padStart(14)),
      textField(row, 64, p.reviewFlag === FLAG_YES ? FLAG_YES_LETTER : FLAG_NO_LETTER),
    );
    if (state.tamper) fields.push(inputField(`amt:${slot}`, row, EDIT_COL, EDIT_LENGTH));
  });
  const sums = totals(working.postings);
  fields.push(
    textField(TOTALS_ROW, 5, 'DEBITS'),
    textField(TOTALS_ROW, 12, formatCents(sums.debit)),
    textField(TOTALS_ROW, 41, 'CREDITS'),
    textField(TOTALS_ROW, 49, formatCents(sums.credit)),
    textField(HINT_ROW, 1, state.tamper ? 'TYPE NEW CENTS, ENTER APPLIES. PF12 TO LEAVE TAMPER MODE' : 'PF12: EDIT AMOUNTS (TAMPER MODE)'),
    textField(ENTER_ROW, 1, state.tamper ? 'ENTER: APPLY AMOUNTS' : 'ENTER: PROVE SCREEN'),
  );
  return fields;
}

export const ctm200: ScreenDef = {
  layout(state): ScreenLayout {
    const pf: PfEntry[] = [
      { pf: 3, label: 'BACK', run: (s) => ({ state: goTo(s, 'CTM100'), effects: [] }) },
      { pf: 7, label: 'PREV', run: pageMove(-1) },
      { pf: 8, label: 'NEXT', run: pageMove(1) },
      { pf: 12, label: state.tamper ? 'END TAMPER' : 'TAMPER', run: toggleTamper },
    ];
    return { fields: [...headerFields('CTM200'), ...bodyFields(state)], pf };
  },
  submit(state, values) {
    if (state.tamper) return applyAmountEdits(state, values);
    return { state: goTo(state, 'CTM300'), effects: [] };
  },
};
