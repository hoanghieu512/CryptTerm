import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { VERIFY_LINK_PREFIX, verifyLinkFor } from '../../src/ui/model/links';
import type { PfNumber, TerminalState } from '../../src/ui/model/types';
import { TerminalView } from '../../src/ui/terminal-view';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { runProperty } from '../support/pbt';
import { GOOD_BATCH, ctm300, rowsOf, withDone } from '../support/prove-state';

// Tests Property 1 and ctm300_verify_anchor (release Requirements 3.1, 3.2). The Prove_Screen is
// drawn for a finished proof. The full Verify_Link is in the `href` of the one anchor and in no
// body row, and the anchor text is OPEN VERIFIER.

const NO_PF = (_pf: PfNumber): void => undefined;
const BODY_ROW_COUNT = 22;

function markupOf(state: TerminalState): string {
  return renderToStaticMarkup(createElement(TerminalView, { state, onPf: NO_PF }));
}

const BASE = ctm300(GOOD_BATCH);

describe('verify_anchor', () => {
  // Feature: release, Property 1: The full Verify_Link never appears on a body row
  it('verify_anchor: the full link is only the href, no body row holds it, the text is OPEN VERIFIER (P1)', () => {
    runProperty(
      'release P1 verify_anchor',
      { seed: 20264401, numRuns: 100 },
      fc.property(proofBundleArb, (bundle) => {
        const state = withDone(BASE, bundle);
        const link = verifyLinkFor(bundle);
        const rows = rowsOf(state).slice(0, BODY_ROW_COUNT);
        expect(rows.some((row) => row.includes(link))).toBe(false);
        const markup = markupOf(state);
        const anchors = Array.from(markup.matchAll(/<a\b[^>]*>([^<]*)<\/a>/g));
        expect(anchors).toHaveLength(1);
        expect(anchors[0]?.[1]).toBe('OPEN VERIFIER');
        expect(Array.from(markup.matchAll(/\bhref="([^"]*)"/g), (m) => m[1])).toEqual([link]);
        // The link is in the markup once: as that href and nowhere else (no text, no label).
        expect(markup.split(link)).toHaveLength(2);
      }),
    );
  });

  it('ctm300_verify_anchor: no grid row holds the full link, and the LINK preview row is still there', () => {
    const [bundle] = fc.sample(proofBundleArb, { seed: 20264402, numRuns: 1 });
    if (bundle === undefined) throw new Error('FIXTURE: NO BUNDLE');
    const state = withDone(BASE, bundle);
    const link = verifyLinkFor(bundle);
    const rows = rowsOf(state);
    expect(rows.filter((row) => row.includes(link))).toEqual([]);
    const linkRows = rows.filter((row) => row.startsWith('LINK '));
    expect(linkRows).toHaveLength(1);
    expect(linkRows[0]).toContain(VERIFY_LINK_PREFIX);
    expect(linkRows[0]).toContain(`(${link.length} CHARS)`);
  });
});
