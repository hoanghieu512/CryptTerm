import { describe, expect, it } from 'vitest';
import { LIMIT_CENTS } from '../../src/ledger/invariants';
import type { Batch } from '../../src/ledger/batch';
import { PROVE_STAGES } from '../../src/zk/worker-protocol';
import { AMOUNT_INPUT_MESSAGES, formatCents } from '../../src/ui/model/amount-input';
import type { AmountInputError } from '../../src/ui/model/amount-input';
import { MESSAGES } from '../../src/ui/model/messages';
import * as proveFlow from '../../src/ui/model/prove-flow';
import { update } from '../../src/ui/model/update';
import { exampleBundle, tick } from '../support/fake-prove';
import { GOOD_BATCH, ctm300, rowsOf, withLimitText } from '../support/prove-state';
import { ENTER, committedSample, editSlot, loadedState, pf, step } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';

// CTM300 prove flow: examples. Rows (1-based): 24 is the status line, 1 to 22 the body.
const STATUS_ROW = 23; // index of row 24 in the `renderGrid` array

function bodyText(rows: readonly string[]): string {
  return rows.slice(0, 22).join('\n');
}

describe('prove_flow_exports', () => {
  it('names the flow functions of design section F', () => {
    for (const fn of [proveFlow.startProve, proveFlow.onProveProgress, proveFlow.onProveDone, proveFlow.onProveFailed]) {
      expect(typeof fn).toBe('function');
    }
  });
});

describe('limit_field_prefill_and_rules', () => {
  const INVALID: readonly (readonly [string, AmountInputError])[] = [
    ['', 'EMPTY'],
    ['abc', 'NOT_DIGITS'],
    ['-5', 'NOT_DIGITS'],
    ['1.5', 'NOT_DIGITS'],
    ['1e3', 'NOT_DIGITS'],
    ['5 ', 'NOT_DIGITS'],
    ['007', 'LEADING_ZERO'],
    ['1099511627776', 'OUT_OF_RANGE'],
    ['12345678901234', 'OUT_OF_RANGE'],
    ['9007199254740993', 'OUT_OF_RANGE'],
  ];

  it('limit_field_prefill_and_rules: the field holds the decimal text of LIMIT_CENTS on entry', () => {
    const s = ctm300();
    expect(s.screen).toBe('CTM300');
    expect(s.fields.limit).toBe(LIMIT_CENTS.toString());
    expect(bodyText(rowsOf(s))).toContain('POLICY LIMIT (CENTS)');
    expect(s.cursor?.fieldId).toBe('limit');
  });

  it('limit_field_prefill_and_rules: prefilled again on every entry, a typed limit is not kept', () => {
    const back = step(withLimitText(ctm300(), '5'), pf(3));
    expect(back.screen).toBe('CTM200');
    const again = step(back, ENTER);
    expect(again.screen).toBe('CTM300');
    expect(again.fields.limit).toBe(LIMIT_CENTS.toString());
  });

  it.each(['0', '1', '1000000', '1099511627775'])('limit_field_prefill_and_rules: Enter accepts %s', (text) => {
    const result = update(withLimitText(ctm300(), text), ENTER);
    expect(result.effects).toEqual([]);
    expect(result.state.status).toBe(MESSAGES.LIMIT_OK);
    expect(result.state.fields.limit).toBe(text);
    expect(result.state.prove.kind).toBe('idle');
  });

  it.each(INVALID)('limit_field_prefill_and_rules: Enter refuses %j with a fixed message', (text, error) => {
    const result = update(withLimitText(ctm300(), text), ENTER);
    expect(result.effects).toEqual([]);
    expect(result.state.status).toBe(AMOUNT_INPUT_MESSAGES[error]);
    expect(result.state.cursor?.fieldId).toBe('limit');
    expect(result.state.prove.kind).toBe('idle');
    if (text.length > 2) expect(rowsOf(result.state)[STATUS_ROW]).not.toContain(text);
  });

  it.each(INVALID)('limit_field_prefill_and_rules: PF5 with limit %j starts no run', (text, error) => {
    const result = update(withLimitText(ctm300(), text), pf(5));
    expect(result.effects).toEqual([]);
    expect(result.state.status).toBe(AMOUNT_INPUT_MESSAGES[error]);
    expect(result.state.cursor?.fieldId).toBe('limit');
    expect(result.state.prove.kind).toBe('idle');
  });
});

describe('prove_progress_stages', () => {
  it('prove_progress_stages: every reported stage name reaches the status line, an unknown name is ignored', () => {
    const state = ctm300();
    const h = makeHarness({ initial: state });
    h.terminal.dispatch(pf(5));
    expect(h.fake.calls).toHaveLength(1);
    const call = h.fake.calls[0];
    expect(call?.batch).toStrictEqual(GOOD_BATCH);
    expect(call?.limitCents).toBe(LIMIT_CENTS);
    expect(call?.digest).toBe(state.sample?.digest);
    expect(h.terminal.getState().status).toBe(`${MESSAGES.PROVING}PRECHECK`);

    for (const stage of PROVE_STAGES) {
      h.fake.progress(stage);
      const now = h.terminal.getState();
      expect(now.status).toBe(`${MESSAGES.PROVING}${stage}`);
      expect(rowsOf(now)[STATUS_ROW]).toContain(`PROVING: ${stage}`);
      expect(now.prove.kind).toBe('proving');
    }
    const before = h.terminal.getState();
    h.fake.progress('NOT A STAGE');
    expect(h.terminal.getState().status).toBe(before.status);
  });
});

describe('prove_success_screen', () => {
  const WORD = 'verified';

  it('prove_success_screen: PROOF GENERATED with circuit version and batch id, and never the word VERIFIED', async () => {
    const h = makeHarness({ initial: ctm300() });
    const seen: string[] = [rowsOf(h.terminal.getState()).join('\n')];
    h.terminal.dispatch(pf(5));
    seen.push(rowsOf(h.terminal.getState()).join('\n'));
    for (const stage of PROVE_STAGES) {
      h.fake.progress(stage);
      seen.push(rowsOf(h.terminal.getState()).join('\n'));
    }
    const bundle = exampleBundle();
    h.fake.resolve(bundle);
    await tick();

    const done = h.terminal.getState();
    expect(done.prove.kind).toBe('done');
    const rows = rowsOf(done);
    seen.push(rows.join('\n'));
    const body = bodyText(rows);
    expect(body).toContain('PROOF GENERATED');
    expect(body).toContain(`CIRCUIT ${bundle.circuitVersion}`);
    expect(body).toContain(`BATCH ${bundle.batchId}`);
    expect(body).toContain(`LIMIT ${formatCents(bundle.limitCents)}`);
    expect(rows[STATUS_ROW]).toContain(MESSAGES.DONE);
    for (const text of seen) expect(text.toLowerCase()).not.toContain(WORD);
  });

  it('prove_success_screen: a failed run and a refused run never show the word either', async () => {
    const h = makeHarness({ initial: ctm300() });
    h.terminal.dispatch(pf(5));
    h.fake.reject(new Error('x'));
    await tick();
    expect(h.terminal.getState().prove.kind).toBe('failed');
    expect(rowsOf(h.terminal.getState()).join('\n').toLowerCase()).not.toContain(WORD);
  });
});

// Two postings on the same side that can swap one cent and stay within the limit or flagged.
function movePair(batch: Batch): readonly [number, number] {
  const ps = batch.postings;
  for (let i = 0; i < ps.length; i += 1) {
    for (let j = 0; j < ps.length; j += 1) {
      const a = ps[i];
      const b = ps[j];
      if (a === undefined || b === undefined || i === j || a.side !== b.side || a.amountCents < 1n) continue;
      if (b.amountCents + 1n <= LIMIT_CENTS || b.reviewFlag === 1n) return [i, j];
    }
  }
  throw new Error('FIXTURE: NO PAIR TO MOVE A CENT BETWEEN');
}

describe('tamper_cases_on_ctm300', () => {
  const clean = committedSample('clean').batch;

  function onCtm300After(edits: readonly (readonly [number, bigint])[]) {
    let s = loadedState(clean);
    for (const [slot, cents] of edits) s = editSlot(s, slot, cents);
    expect(s.tamper).toBe(true);
    s = step(s, pf(12));
    expect(s.tamper).toBe(false);
    s = step(s, ENTER);
    expect(s.screen).toBe('CTM300');
    return s;
  }

  it('tamper_cases_on_ctm300: a 1-cent edit shows REJECTED: UNBALANCED and the port is not called', () => {
    const first = clean.postings[0];
    if (first === undefined) throw new Error('FIXTURE: EMPTY SAMPLE');
    const h = makeHarness({ initial: onCtm300After([[0, first.amountCents + 1n]]) });
    h.terminal.dispatch(pf(5));
    expect(h.fake.calls).toHaveLength(0);
    expect(h.terminal.getState().status).toBe('REJECTED: UNBALANCED');
    const row = rowsOf(h.terminal.getState())[STATUS_ROW] ?? '';
    expect(row).toContain('REJECTED: UNBALANCED');
    expect(row).toContain('TAMPERED');
  });

  it('tamper_cases_on_ctm300: a balanced 1-cent move starts a run with the edited batch and gives a bundle', async () => {
    const [from, to] = movePair(clean);
    const fromCents = clean.postings[from]?.amountCents ?? 0n;
    const toCents = clean.postings[to]?.amountCents ?? 0n;
    const initial = onCtm300After([
      [from, fromCents - 1n],
      [to, toCents + 1n],
    ]);
    const h = makeHarness({ initial });
    h.terminal.dispatch(pf(5));
    expect(h.fake.calls).toHaveLength(1);
    const call = h.fake.calls[0];
    expect(call?.batch.postings[from]?.amountCents).toBe(fromCents - 1n);
    expect(call?.batch.postings[to]?.amountCents).toBe(toCents + 1n);
    expect(call?.digest).toBe(initial.sample?.digest);

    h.fake.resolve(exampleBundle());
    await tick();
    const done = h.terminal.getState();
    expect(done.prove.kind).toBe('done');
    expect(rowsOf(done)[STATUS_ROW]).toContain('TAMPERED');
  });
});

// The sample batches that fail the on-page check give the named reason at once.
describe('tamper_cases_on_ctm300: committed samples', () => {
  it.each([
    ['unbalanced', 'REJECTED: UNBALANCED'],
    ['over-limit-unflagged', 'REJECTED: OVER_LIMIT_UNFLAGGED'],
  ])('%s gives %s without a port call', (name, text) => {
    const h = makeHarness({ initial: step(loadedState(committedSample(name).batch), ENTER) });
    h.terminal.dispatch(pf(5));
    expect(h.fake.calls).toHaveLength(0);
    expect(h.terminal.getState().status).toBe(text);
    expect(h.terminal.getState().prove.kind).toBe('failed');
  });
});
