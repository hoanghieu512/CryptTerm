import { describe, expect, it } from 'vitest';
import { LIMIT_CENTS } from '../../src/ledger/invariants';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { VERIFY_STEP_ORDER } from '../../src/ui/model/verify-flow';
import { VERIFY_DETAILS } from '../../src/zk/verifier';
import { flush } from '../support/fake-verify';
import { TINY_BATCH, stateOn } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';
import { wellFormedReport } from '../support/verify-arbitraries';

// Group 2 example tests of the verifier spec: the start of a run and the pinned step order.
// Data is synthetic.

const BUNDLE_TEXT = 'SYNTHETIC-BUNDLE-TEXT';

describe('verify_run_start', () => {
  it('verify_run_start: Enter calls the verifier once with the text and the parsed limit', () => {
    const { terminal, verifier } = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    terminal.dispatch({ type: 'PASTE_TEXT', text: BUNDLE_TEXT });
    terminal.dispatch({ type: 'ENTER' });
    expect(verifier.calls).toEqual([{ text: BUNDLE_TEXT, limitCents: LIMIT_CENTS }]);
    expect(typeof verifier.calls[0]?.limitCents).toBe('bigint');
    expect(terminal.getState().status).toBe(MESSAGES.VERIFYING);
    expect(terminal.getState().verify.run).not.toBeNull();
  });

  it('verify_run_start: with source NONE the verifier gets the empty text', () => {
    const { terminal, verifier } = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    terminal.dispatch({ type: 'ENTER' });
    expect(verifier.calls).toEqual([{ text: '', limitCents: LIMIT_CENTS }]);
  });

  it('verify_run_start: the parsed limit is the typed one, as a bigint', () => {
    const { terminal, verifier } = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    terminal.dispatch({ type: 'TAB', back: false });
    for (let i = 0; i < 13; i += 1) terminal.dispatch({ type: 'BACKSPACE' });
    for (const ch of '500000') terminal.dispatch({ type: 'CHAR', ch });
    terminal.dispatch({ type: 'ENTER' });
    expect(verifier.calls).toEqual([{ text: '', limitCents: 500_000n }]);
  });

  it('verify_run_start: an earlier report is cleared from the screen when a new run starts', async () => {
    const { terminal, verifier } = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    terminal.dispatch({ type: 'PASTE_TEXT', text: BUNDLE_TEXT });
    terminal.dispatch({ type: 'ENTER' });
    verifier.resolve(wellFormedReport(2));
    await flush();
    const shown = renderGrid(terminal.getState()).join('\n');
    expect(shown).toContain('REJECTED AT DIGEST_MATCH');
    terminal.dispatch({ type: 'ENTER' });
    const running = renderGrid(terminal.getState()).join('\n');
    expect(running).not.toContain('REJECTED AT');
    expect(running).not.toContain('NOT RUN');
    expect(terminal.getState().verify.result).toBeNull();
    expect(verifier.calls).toHaveLength(2);
  });
});

describe('verify_step_order_pinned', () => {
  it('verify_step_order_pinned: VERIFY_STEP_ORDER equals the keys of VERIFY_DETAILS, in order', () => {
    expect([...VERIFY_STEP_ORDER]).toEqual(Object.keys(VERIFY_DETAILS));
    expect(VERIFY_STEP_ORDER).toHaveLength(6);
  });
});
