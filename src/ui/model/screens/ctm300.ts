// CTM300 PROVE (terminal-ui design, sections B and F): batch id, totals of the Working_Batch, the
// policy limit field, the run or result lines, and the link row once a bundle exists.
//
// The layout and the totals must not throw for a batch that is not well formed (no postings, more
// than 64, an amount that is not a bigint): such a batch is refused by checkBatch at PF5, and the
// screen still draws. The word VERIFIED never appears here: the verifier owns it.
import { SIDE_CREDIT, SIDE_DEBIT } from '../../../ledger/posting';
import { formatCents } from '../amount-input';
import { VERIFY_LINK_PREFIX } from '../links';
import {
  checkLimitField,
  copyBundle,
  leaveProve,
  openVerifier,
  saveBundle,
  startProve,
  workingBatchOf,
} from '../prove-flow';
import type { Field, PfEntry, ProveState, ScreenDef, ScreenLayout, TerminalState } from '../types';
import { headerFields, inputField, textField } from './common';

const BATCH_ROW = 3;
const TOTALS_ROW = 4;
const LIMIT_ROW = 6;
const LIMIT_LABEL = 'POLICY LIMIT (CENTS)';
const LIMIT_LENGTH = 13;
const RESULT_ROW = 8;
const LINK_ROW = 15;
const ENCODED_PREVIEW = 40;

/** Debit and credit sums of whatever is in `postings`. Anything that is not a bigint is skipped. */
function totalsOf(postings: unknown): { debit: bigint; credit: bigint } {
  let debit = 0n;
  let credit = 0n;
  if (!Array.isArray(postings)) return { debit, credit };
  for (const p of postings as unknown[]) {
    if (typeof p !== 'object' || p === null) continue;
    const { side, amountCents } = p as { side?: unknown; amountCents?: unknown };
    if (typeof amountCents !== 'bigint') continue;
    if (side === SIDE_DEBIT) debit += amountCents;
    else if (side === SIDE_CREDIT) credit += amountCents;
  }
  return { debit, credit };
}

function summaryFields(state: TerminalState): Field[] {
  const sample = state.sample;
  if (sample === null) return [];
  const working = workingBatchOf(sample, state.edits);
  const batchId: unknown = working.batchId;
  const sums = totalsOf(working.postings);
  return [
    textField(BATCH_ROW, 1, `BATCH ${typeof batchId === 'string' ? batchId : ''}`),
    textField(TOTALS_ROW, 1, `DEBITS ${formatCents(sums.debit)}`),
    textField(TOTALS_ROW, 41, `CREDITS ${formatCents(sums.credit)}`),
  ];
}

/** The link row: the prefix and the first characters of the encoded bundle, then the length. */
function linkRow(link: string): string {
  const encoded = link.slice(VERIFY_LINK_PREFIX.length);
  return `LINK ${VERIFY_LINK_PREFIX}${encoded.slice(0, ENCODED_PREVIEW)}... (${link.length} CHARS)`;
}

function resultFields(prove: ProveState): Field[] {
  switch (prove.kind) {
    case 'idle':
      return [textField(RESULT_ROW, 1, 'PF5: GENERATE PROOF')];
    case 'proving':
      return [textField(RESULT_ROW, 1, 'PROOF IN PROGRESS'), textField(RESULT_ROW + 1, 1, `STAGE ${prove.stage}`)];
    case 'failed':
      return [textField(RESULT_ROW, 1, 'PROOF NOT GENERATED'), textField(RESULT_ROW + 1, 1, prove.message)];
    case 'done':
      return [
        textField(RESULT_ROW, 1, 'PROOF GENERATED'),
        textField(RESULT_ROW + 2, 1, `CIRCUIT ${prove.bundle.circuitVersion}`),
        textField(RESULT_ROW + 3, 1, `BATCH ${prove.bundle.batchId}`),
        textField(RESULT_ROW + 4, 1, `LIMIT ${formatCents(prove.bundle.limitCents)}`),
        textField(LINK_ROW, 1, linkRow(prove.link)),
        textField(RESULT_ROW + 9, 1, 'PF9 COPY BUNDLE  PF10 SAVE FILE  PF11 OPEN LINK'),
      ];
  }
}

export const ctm300: ScreenDef = {
  layout(state): ScreenLayout {
    const pf: PfEntry[] = [
      { pf: 3, label: 'BACK', run: leaveProve },
      { pf: 5, label: 'PROVE', run: startProve },
    ];
    if (state.prove.kind === 'done') {
      pf.push(
        { pf: 9, label: 'COPY', run: copyBundle },
        { pf: 10, label: 'SAVE', run: saveBundle },
        { pf: 11, label: 'LINK', run: openVerifier },
      );
    }
    return {
      fields: [
        ...headerFields('CTM300'),
        ...summaryFields(state),
        textField(LIMIT_ROW, 1, LIMIT_LABEL),
        inputField('limit', LIMIT_ROW, LIMIT_LABEL.length + 2, LIMIT_LENGTH),
        ...resultFields(state.prove),
      ],
      pf,
    };
  },
  submit: checkLimitField,
};
