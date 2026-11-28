import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { SIDE_CREDIT, SIDE_DEBIT } from '../../src/ledger/posting';
import type { Cents, Posting } from '../../src/ledger/posting';
import { maskAccount } from '../../src/ledger/mask';
import { formatCents } from '../../src/ui/model/amount-input';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { pageSlots } from '../../src/ui/model/tamper';
import type { TerminalState } from '../../src/ui/model/types';
import { amountArb, batchArb, padDigits } from '../support/ledger-arbitraries';
import { runProperty } from '../support/pbt';
import { PAGE_SIZE_UNDER_TEST, committedSample, editSlot, loadedState, pf, step } from '../support/terminal-arbitraries';

// CTM200 batch view. Rows (1-based): 2 batch id and page, 3 digest status, 5 headers,
// 6 to 17 postings (slot number in columns 1 to 3), 19 totals.

const FIRST_POSTING_ROW = 6;
const ROW_COUNT = PAGE_SIZE_UNDER_TEST;

type Edit = readonly [number, Cents];
const editsArb: fc.Arbitrary<Edit[]> = fc.array(fc.tuple(fc.nat(), amountArb), { maxLength: 4 });

/** Applies the edits through the model. Slot numbers wrap onto the batch size. */
function withEdits(batch: Batch, edits: readonly Edit[]): TerminalState {
  return edits.reduce<TerminalState>((s, [i, cents]) => editSlot(s, i % batch.postings.length, cents), loadedState(batch));
}

/** Reference: the postings after the same edits, later edits winning. No model code involved. */
function editedPostings(batch: Batch, edits: readonly Edit[]): Posting[] {
  const postings = batch.postings.map((p) => ({ ...p }));
  for (const [i, cents] of edits) {
    const slot = i % postings.length;
    postings[slot] = { ...(postings[slot] as Posting), amountCents: cents };
  }
  return postings;
}

/** Slot numbers (1-based) shown on one rendered page. */
function slotsShown(rows: readonly string[]): number[] {
  return rows
    .slice(FIRST_POSTING_ROW - 1, FIRST_POSTING_ROW - 1 + ROW_COUNT)
    .map((r) => r.slice(0, 3).trim())
    .filter((t) => t !== '')
    .map((t) => {
      expect(t).toMatch(/^[1-9][0-9]*$/);
      return Number(t); // a slot number, not an amount
    });
}

/** Every page of the state, from page 0, by PF8 until the page stops changing. */
function allPages(start: TerminalState): TerminalState[] {
  const pages: TerminalState[] = [];
  let s = start;
  for (let i = 0; i < 20; i += 1) {
    pages.push(s);
    const next = step(s, pf(8));
    if (next.page === s.page) break;
    s = next;
  }
  return pages;
}

/** Accounts of 16 to 18 digits and small record ids, so that no other text can equal an account. */
const maskBatchArb: fc.Arbitrary<Batch> = batchArb.map((b) => ({
  batchId: b.batchId,
  postings: b.postings.map((p) => ({
    ...p,
    account: 10n ** 15n + (p.account % (9n * 10n ** 17n)),
    recordId: p.recordId % 1_000_000n,
  })),
}));

function expectNoFullAccount(rows: readonly string[], batch: Batch): void {
  const text = rows.join('\n');
  for (const p of batch.postings) {
    expect(text.includes(padDigits(p.account, 20))).toBe(false);
    if (p.account.toString().length > 4) expect(text.includes(p.account.toString())).toBe(false);
  }
}

// Feature: terminal-ui, Property 9: No rendered text shows an account in full
// **Validates: Requirements 4.2**
describe('masked_accounts', () => {
  it('masked_accounts: no page shows an account in full, before or after edits (P9)', () => {
    runProperty('masked_accounts', { seed: 20264009, numRuns: 200 }, fc.property(maskBatchArb, editsArb, (batch, edits) => {
      for (const state of [loadedState(batch), withEdits(batch, edits)]) {
        for (const page of allPages(state)) {
          const rows = renderGrid(page);
          expectNoFullAccount(rows, batch);
          for (const slot of pageSlots(page)) {
            const account = (batch.postings[slot] as Posting).account;
            expect(rows.some((r) => r.includes(maskAccount(account)))).toBe(true);
          }
        }
      }
    }));
  }, 30000);

  it.each(['clean', 'over-limit-unflagged', 'unbalanced', 'large'])('masked_accounts: sample %s, every page, before and after an edit', (name) => {
    const batch = committedSample(name).batch;
    for (const state of [loadedState(batch), editSlot(loadedState(batch), 0, 12345n)]) {
      for (const page of allPages(state)) expectNoFullAccount(renderGrid(page), batch);
    }
  });
});

// Feature: terminal-ui, Property 10: Paging shows every posting exactly once, in order
// **Validates: Requirements 4.3**
describe('paging_covers_all_postings', () => {
  it('paging_covers_all_postings: PF8 shows slots 1..n once and in order (P10)', () => {
    runProperty('paging_covers_all_postings', { seed: 20264010, numRuns: 200 }, fc.property(batchArb, (batch) => {
      const n = batch.postings.length;
      const pages = allPages(loadedState(batch));
      const pageCount = Math.ceil(n / ROW_COUNT);
      expect(pages.length).toBe(pageCount);
      const shown = pages.flatMap((p) => slotsShown(renderGrid(p)));
      expect(shown).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      pages.forEach((p, i) => {
        const header = renderGrid(p)[1] ?? '';
        expect(header).toContain(batch.batchId);
        expect(header).toContain(`PAGE ${i + 1}/${pageCount}`);
        expect(pageSlots(p)).toEqual(slotsShown(renderGrid(p)).map((s) => s - 1));
      });
      const first = loadedState(batch);
      const back = step(first, pf(7));
      expect(back.page).toBe(0);
      expect(back.status).toBe(MESSAGES.FIRST_PAGE);
      const last = pages[pages.length - 1] as TerminalState;
      const past = step(last, pf(8));
      expect(past.page).toBe(last.page);
      expect(past.status).toBe(MESSAGES.LAST_PAGE);
    }));
  }, 30000);
});

// Feature: terminal-ui, Property 11: Displayed totals equal the bigint sums
// **Validates: Requirements 4.4**
describe('totals_match_invariants', () => {
  it('totals_match_invariants: row 19 equals the bigint sums of the working batch (P11)', () => {
    runProperty('totals_match_invariants', { seed: 20264011, numRuns: 200 }, fc.property(batchArb, editsArb, (batch, edits) => {
      const postings = editedPostings(batch, edits);
      const sum = (side: bigint): bigint => postings.filter((p) => p.side === side).reduce((a, p) => a + p.amountCents, 0n);
      const state = withEdits(batch, edits);
      for (const page of allPages(state)) {
        const row = renderGrid(page)[18] ?? '';
        const m = /DEBITS\s+(\S+)\s+CREDITS\s+(\S+)/.exec(row);
        expect(m, 'totals row').not.toBeNull();
        expect(m?.[1]).toBe(formatCents(sum(SIDE_DEBIT)));
        expect(m?.[2]).toBe(formatCents(sum(SIDE_CREDIT)));
      }
    }));
  });

  it('totals_match_invariants: a 64-posting batch of the largest amounts still fits row 19', () => {
    const big: Posting = { recordId: 1n, account: 10n ** 15n, side: SIDE_DEBIT, amountCents: 2n ** 40n - 1n, reviewFlag: 0n, salt: 1n };
    const batch: Batch = { batchId: 'CTB-20261201-001', postings: Array.from({ length: 64 }, () => big) };
    const row = renderGrid(loadedState(batch))[18] ?? '';
    expect(row).toContain('DEBITS');
    expect(row).toContain(formatCents(64n * (2n ** 40n - 1n)));
    expect(row.length).toBe(80);
  });
});
