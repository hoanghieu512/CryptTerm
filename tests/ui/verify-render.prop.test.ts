import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { sourceKeyIdOf } from '../../src/ui/model/source-key-id';
import type { TerminalState } from '../../src/ui/model/types';
import { TerminalView } from '../../src/ui/terminal-view';
import { bundleToJson, encodeBundleForUrl } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { CIRCUIT_VERSION } from '../../src/zk/circuit-identity';
import { VERIFY_DETAILS } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { hexStringArb } from '../support/digest-arbitraries';
import { flush } from '../support/fake-verify';
import { runProperty } from '../support/pbt';
import { TINY_BATCH, stateOn } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';
import type { Harness } from '../support/terminal-host';
import { DETAIL_SENTINEL, STEP_NAMES, reportShapeArb, wellFormedReport } from '../support/verify-arbitraries';

// Group 2 render tests of the verifier spec (Properties 13 and 14): the six Step_Rows, the verdict,
// the key row and the sentinel scan, for the seven report shapes. The verifier is a fake whose
// report holds sentinels in every `detail`. Data is synthetic.

const PLANTED_VERSION = 'nargo-9.9.9+PLANTEDCIRCUITVERSION';
const KEY_PUBLIC = 'ab'.repeat(32);
const STEP_ROW_FIRST = 9; // row 10, 0-based
const VERDICT_ROW = 16; // row 17
const KEY_ROW = 17; // row 18
const CIRCUIT_ROW = 19; // row 20

const baseBundle: ProofBundle = (() => {
  const [first] = fc.sample(proofBundleArb, { seed: 20264913, numRuns: 1 });
  if (first === undefined) throw new Error('FIXTURE: NO BUNDLE');
  return first;
})();

/** A bundle with the given key id and a planted `circuit_version` that the screen must not echo. */
function bundleFor(keyId: string): ProofBundle {
  return { ...baseBundle, sourceKeyId: keyId, circuitVersion: PLANTED_VERSION };
}

function tableWith(keyId: string): Record<string, string> {
  const table: Record<string, string> = {};
  Object.defineProperty(table, keyId, { value: KEY_PUBLIC, enumerable: true });
  return table;
}

function domText(state: TerminalState): string {
  return renderToStaticMarkup(createElement(TerminalView, { state, onPf: () => undefined }));
}

function wordRows(state: TerminalState, word: string): number {
  return renderGrid(state).filter((row) => row.includes(word)).length;
}

/** Slices of a long text: its start, middle and end, 20 characters each. */
function slicesOf(text: string): string[] {
  const mid = Math.floor(text.length / 2);
  return [text.slice(0, 20), text.slice(mid, mid + 20), text.slice(-20)];
}

function startRun(h: Harness, text: string): void {
  h.terminal.dispatch({ type: 'PASTE_TEXT', text });
  h.terminal.dispatch({ type: 'ENTER' });
}

function expectedStepRow(name: string, i: number, k: number): string {
  const details = VERIFY_DETAILS[name as keyof typeof VERIFY_DETAILS];
  const label = name.padEnd(12);
  if (i < k) return `${label}  ${'OK'.padEnd(7)}  ${details.ok}`;
  if (i === k) return `${label}  ${'FAIL'.padEnd(7)}  ${details.fail}`;
  return `${label}  NOT RUN`;
}

describe('verify_steps_render', () => {
  // Feature: verifier, Property 13: Step rows, verdict and no echo
  // **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.4**
  it('verify_steps_render (Property 13): six rows, verdict, key row and no echo for every report shape', async () => {
    await runProperty(
      'verify_steps_render',
      { seed: 20264913, numRuns: 200 },
      fc.asyncProperty(reportShapeArb, hexStringArb(16), async (k, hex) => {
        const keyId = `DEMO-${hex}`;
        const text = bundleToJson(bundleFor(keyId));
        const h = makeHarness({ initial: stateOn('CTM900', TINY_BATCH), deps: { trustedKeys: tableWith(keyId) } });
        // Before any run, and while running: no VERIFIED anywhere.
        expect(wordRows(h.terminal.getState(), 'VERIFIED')).toBe(0);
        startRun(h, text);
        expect(wordRows(h.terminal.getState(), 'VERIFIED')).toBe(0);
        expect(renderGrid(h.terminal.getState())[VERDICT_ROW]?.trim()).toBe(MESSAGES.VERIFYING);
        h.verifier.resolve(wellFormedReport(k));
        await flush();
        const state = h.terminal.getState();
        const grid = renderGrid(state);
        STEP_NAMES.forEach((name, i) => {
          expect(grid[STEP_ROW_FIRST + i]?.trimEnd()).toBe(expectedStepRow(name, i, k));
        });
        expect(grid[VERDICT_ROW]?.trim()).toBe(k === 6 ? 'VERIFIED' : `REJECTED AT ${STEP_NAMES[k]}`);
        expect(wordRows(state, 'VERIFIED')).toBe(k === 6 ? 1 : 0);
        // The key id and DEMO KEY show only when SIGNATURE is OK.
        expect(grid[KEY_ROW]?.trim()).toBe(k >= 2 ? `SOURCE KEY ${keyId}  DEMO KEY` : '');
        expect(grid[CIRCUIT_ROW]?.trim()).toBe(`VERIFIER CIRCUIT ${CIRCUIT_VERSION}`);
        // No echo: sentinels, the planted circuit version, slices of the bundle text, and the key id
        // of a failed report appear in no grid row and no DOM text.
        const shown = `${grid.join('\n')}\n${domText(state)}`;
        const banned = [DETAIL_SENTINEL, PLANTED_VERSION, 'PLANTEDCIRCUITVERSION', ...slicesOf(text)];
        if (k < 2) banned.push(keyId);
        for (const word of banned) expect(shown).not.toContain(word);
      }),
    );
  });

  it('verify_steps_render: a stale drop and a failure show no VERIFIED', async () => {
    const h = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    startRun(h, 'SYNTHETIC-BUNDLE-TEXT');
    h.terminal.dispatch({ type: 'PASTE_TEXT', text: 'EDITED' });
    h.verifier.resolve(wellFormedReport(6));
    await flush();
    expect(wordRows(h.terminal.getState(), 'VERIFIED')).toBe(0);
    h.terminal.dispatch({ type: 'ENTER' });
    h.verifier.resolve(null);
    await flush();
    expect(wordRows(h.terminal.getState(), 'VERIFIED')).toBe(0);
  });

  it('verify_steps_render: the model keeps no key id for a report that failed before SIGNATURE passed', () => {
    for (const k of [0, 1]) {
      const h = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
      startRun(h, 'SYNTHETIC-BUNDLE-TEXT');
      const runId = h.terminal.getState().verify.run?.runId ?? -1;
      // The host would pass null here. The model must not trust that, so a key id is sent anyway.
      h.terminal.dispatch({ type: 'VERIFY_DONE', runId, report: wellFormedReport(k), keyId: 'DEMO-PLANTED-KEY' });
      const state = h.terminal.getState();
      expect(state.verify.result?.outcome).toEqual({ kind: 'report', passed: k, keyId: null });
      expect(`${renderGrid(state).join('\n')}\n${domText(state)}`).not.toContain('DEMO-PLANTED-KEY');
    }
  });

  it('verify_steps_render: a bundle whose source_key_id is __proto__ shows no key row', async () => {
    const text = bundleToJson(bundleFor('__proto__'));
    const h = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    startRun(h, text);
    h.verifier.resolve(wellFormedReport(6));
    await flush();
    const state = h.terminal.getState();
    const grid = renderGrid(state);
    expect(grid[KEY_ROW]?.trim()).toBe('');
    expect(`${grid.join('\n')}\n${domText(state)}`).not.toContain('__proto__');
    expect(state.status).toBe(MESSAGES.VERIFY_DONE);
  });

  it('verify_steps_render: a text that does not decode shows no key row and no error text', async () => {
    const h = makeHarness({ initial: stateOn('CTM900', TINY_BATCH) });
    startRun(h, 'NOT-A-BUNDLE');
    h.verifier.resolve(wellFormedReport(6));
    await flush();
    const state = h.terminal.getState();
    expect(renderGrid(state)[KEY_ROW]?.trim()).toBe('');
    expect(state.status).toBe(MESSAGES.VERIFY_DONE);
  });
});

describe('verify_steps_render source key id', () => {
  // Feature: verifier, Property 14: Key id comes from the trusted table by own property
  // **Validates: Requirements 5.4**
  it('verify_steps_render (Property 14): sourceKeyIdOf returns the id if and only if it decodes and is an own key', () => {
    runProperty(
      'verify_steps_render key id',
      { seed: 20264914, numRuns: 200 },
      fc.property(proofBundleArb, fc.boolean(), fc.boolean(), (bundle, listed, urlForm) => {
        const text = urlForm ? encodeBundleForUrl(bundle) : bundleToJson(bundle);
        const keys = listed ? tableWith(bundle.sourceKeyId) : { 'OTHER-KEY': KEY_PUBLIC };
        expect(sourceKeyIdOf(text, keys)).toBe(listed ? bundle.sourceKeyId : null);
      }),
    );
  });

  it('verify_steps_render: inherited names and texts that do not decode give null', () => {
    const keys = Object.freeze({ 'DEMO-0': KEY_PUBLIC });
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(sourceKeyIdOf(bundleToJson(bundleFor(id)), keys)).toBeNull();
    }
    expect(sourceKeyIdOf('', keys)).toBeNull();
    expect(sourceKeyIdOf('NOT-A-BUNDLE', keys)).toBeNull();
    expect(sourceKeyIdOf(bundleToJson(bundleFor('DEMO-0')).slice(0, 40), keys)).toBeNull();
    expect(sourceKeyIdOf(bundleToJson(bundleFor('DEMO-0')), keys)).toBe('DEMO-0');
  });

  it('verify_steps_render: sourceKeyIdOf never throws for any string', () => {
    runProperty(
      'verify_steps_render key id no throw',
      { seed: 20264914, numRuns: 200 },
      fc.property(fc.string({ maxLength: 40 }), (text) => {
        expect(sourceKeyIdOf(text, {})).toBeNull();
      }),
    );
  });
});
