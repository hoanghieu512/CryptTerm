import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { base64UrlToBytesStrict } from '../../src/zk/base64';
import { bundleToJson, decodeBundle, encodeBundleForUrl } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { MESSAGES } from '../../src/ui/model/messages';
import { VERIFY_LINK_PREFIX, bundleFileName, verifyLinkFor } from '../../src/ui/model/links';
import { update } from '../../src/ui/model/update';
import type { Effect, PfNumber, TerminalState } from '../../src/ui/model/types';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { exampleBundle, tick } from '../support/fake-prove';
import { amountArb, batchArb } from '../support/ledger-arbitraries';
import { runProperty } from '../support/pbt';
import { ctm300, pressProve, rowsOf, withDone } from '../support/prove-state';
import { ENTER, editSlot, pf, stateOn, step } from '../support/terminal-arbitraries';
import { CLIPBOARD_SENTINEL, makeHarness } from '../support/terminal-host';

const BASE = ctm300();
const EXPORT_KEYS: readonly PfNumber[] = [9, 10, 11];

/** Every string held anywhere in an effect. */
function stringsOf(effect: Effect): string[] {
  return Object.values(effect).filter((v): v is string => typeof v === 'string');
}

describe('bundle_actions', () => {
  // Feature: terminal-ui, Property 22: Copy and save effects carry exactly the bundle text
  it('bundle_actions: PF9 and PF10 carry exactly the bundle text, PF11 the link, and nothing else (P22)', () => {
    runProperty('terminal-ui P22 bundle_actions', { seed: 20264022, numRuns: 200 }, fc.property(proofBundleArb, (bundle) => {
      const done = withDone(BASE, bundle);
      const json = bundleToJson(bundle);

      const copy = update(done, pf(9));
      expect(copy.effects).toStrictEqual([{ type: 'CLIPBOARD_WRITE', text: json }]);

      const save = update(done, pf(10));
      expect(save.effects).toStrictEqual([{ type: 'DOWNLOAD', filename: `${bundle.batchId}.proof.json`, text: json }]);
      expect(bundleFileName(bundle)).toBe(`${bundle.batchId}.proof.json`);
      expect(save.state.status).toBe(MESSAGES.DOWNLOAD);

      const open = update(done, pf(11));
      expect(open.effects).toStrictEqual([{ type: 'OPEN_LINK', href: verifyLinkFor(bundle) }]);
      expect(open.state.status).toBe(MESSAGES.OPENING);

      const allowed = new Set([json, `${bundle.batchId}.proof.json`, verifyLinkFor(bundle)]);
      for (const effect of [...copy.effects, ...save.effects, ...open.effects]) {
        for (const text of stringsOf(effect)) {
          if (text !== effect.type) expect(allowed.has(text)).toBe(true);
        }
      }
      // The bundle stays in state for every action.
      for (const result of [copy, save, open]) expect(result.state.prove).toBe(done.prove);

      // A clipboard result changes the status only, and the bundle stays.
      const failed = update(done, { type: 'CLIPBOARD_DONE', ok: false });
      expect(failed.state.status).toBe(MESSAGES.COPY_FAILED);
      expect(failed.state.prove).toBe(done.prove);
      expect(update(failed.state, pf(10)).effects).toHaveLength(1);
      expect(update(done, { type: 'CLIPBOARD_DONE', ok: true }).state.status).toBe(MESSAGES.COPIED);
    }));
  });

  it('bundle_actions: PF9, PF10 and PF11 emit nothing unless a bundle is present', () => {
    const proving = pressProve(BASE).state;
    expect(proving.prove.kind).toBe('proving');
    const failed: TerminalState = { ...BASE, prove: { kind: 'failed', message: 'X' } };
    for (const state of [BASE, proving, failed]) {
      for (const key of EXPORT_KEYS) {
        const result = update(state, pf(key));
        expect(result.effects).toEqual([]);
        expect(result.state.status).toBe(MESSAGES.PF_INACTIVE);
      }
      // A clipboard result with no bundle present is stale.
      expect(update(state, { type: 'CLIPBOARD_DONE', ok: true }).state).toBe(state);
      expect(update(state, { type: 'CLIPBOARD_DONE', ok: false }).state).toBe(state);
    }
  });

  it('bundle_actions: through the host, a rejecting clipboard gives COPY FAILED and keeps the bundle for download', async () => {
    const bundle = exampleBundle();
    const h = makeHarness({ initial: withDone(BASE, bundle), clipboardFails: true });
    h.terminal.dispatch(pf(9));
    await tick();
    const state = h.terminal.getState();
    expect(h.clipboard).toEqual([bundleToJson(bundle)]);
    expect(state.status).toBe(MESSAGES.COPY_FAILED);
    expect(state.prove.kind).toBe('done');
    expect(rowsOf(state).join('\n')).not.toContain(CLIPBOARD_SENTINEL);
    h.terminal.dispatch(pf(10));
    expect(h.downloads).toEqual([{ filename: 'CTB-20261201-001.proof.json', text: bundleToJson(bundle) }]);
  });

  it('bundle_actions: through the host, a working clipboard gives BUNDLE COPIED', async () => {
    const bundle = exampleBundle();
    const h = makeHarness({ initial: withDone(BASE, bundle) });
    h.terminal.dispatch(pf(9));
    await tick();
    expect(h.clipboard).toEqual([bundleToJson(bundle)]);
    expect(h.terminal.getState().status).toBe(MESSAGES.COPIED);
    h.terminal.dispatch(pf(11));
    expect(h.links).toEqual([verifyLinkFor(bundle)]);
  });
});

describe('verify_link_roundtrip', () => {
  // Feature: terminal-ui, Property 23: The verify link decodes to the same bundle
  it('verify_link_roundtrip: the text after #b= decodes to the same bundle, and the grid shows prefix and length (P23)', () => {
    runProperty('terminal-ui P23 verify_link_roundtrip', { seed: 20264023, numRuns: 200 }, fc.property(proofBundleArb, (bundle) => {
      const link = verifyLinkFor(bundle);
      expect(VERIFY_LINK_PREFIX).toBe('/verify#b=');
      expect(link.startsWith(VERIFY_LINK_PREFIX)).toBe(true);
      expect(link).toBe(`${VERIFY_LINK_PREFIX}${encodeBundleForUrl(bundle)}`);
      const encoded = link.slice(VERIFY_LINK_PREFIX.length);
      const decoded: ProofBundle = decodeBundle(new TextDecoder().decode(base64UrlToBytesStrict(encoded)));
      expect(decoded).toStrictEqual(bundle);

      const rows = rowsOf(withDone(BASE, bundle));
      expect(rows.some((r) => r.includes(`LINK ${VERIFY_LINK_PREFIX}${encoded.slice(0, 40)}`))).toBe(true);
      expect(rows.some((r) => r.includes(`(${link.length} CHARS)`))).toBe(true);
      expect(rows.some((r) => r.includes(link))).toBe(false);
    }));
  });
});

describe('bundle_dropped_on_change', () => {
  const doneArb = fc.tuple(batchArb, proofBundleArb, fc.nat(), amountArb);

  // Feature: terminal-ui, Property 24: The bundle is dropped when the batch changes or the sample is left
  it('bundle_dropped_on_change: an applied edit or leaving the sample drops the bundle, an unchanged amount does not (P24)', () => {
    runProperty('terminal-ui P24 bundle_dropped_on_change', { seed: 20264024, numRuns: 200 }, fc.property(doneArb, ([batch, bundle, pick, cents]) => {
      const done = withDone(stateOn('CTM300', batch), bundle);
      const back = step(done, pf(3));
      expect(back.screen).toBe('CTM200');
      expect(back.prove).toBe(done.prove);

      const slot = pick % batch.postings.length;
      const original = batch.postings[slot]?.amountCents;
      const edited = editSlot(back, slot, cents);
      if (cents === original) expect(edited.prove).toBe(done.prove);
      else expect(edited.prove).toEqual({ kind: 'idle' });

      const left = step(back, pf(3));
      expect(left.screen).toBe('CTM100');
      expect(left.prove).toEqual({ kind: 'idle' });
      expect(left.sample).toBeNull();
    }));
  });

  it('bundle_dropped_on_change: the bundle survives CTM300 to CTM200 to CTM300 with no edit', () => {
    const done = withDone(BASE, exampleBundle());
    const again = step(step(done, pf(3)), ENTER);
    expect(again.screen).toBe('CTM300');
    expect(again.prove).toBe(done.prove);
  });

  it('bundle_dropped_on_change: a run that was proving is not a bundle after leaving', () => {
    const proving = pressProve(BASE).state;
    const back = step(proving, pf(3));
    expect(back.prove).toEqual({ kind: 'idle' });
    expect(step(back, ENTER).prove).toEqual({ kind: 'idle' });
  });
});
