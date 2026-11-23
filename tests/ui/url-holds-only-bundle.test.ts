import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TerminalView } from '../../src/ui/terminal-view';
import { verifyLinkFor, VERIFY_LINK_PREFIX } from '../../src/ui/model/links';
import { initialState } from '../../src/ui/model/update';
import type { PfNumber, TerminalState } from '../../src/ui/model/types';
import type { ProofBundle } from '../../src/zk/bundle';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { GOOD_BATCH, ctm300, withDone } from '../support/prove-state';
import { loadedState, onSelectScreen, pf, step } from '../support/terminal-arbitraries';

// Test url_holds_only_bundle (terminal-ui Requirement 9.2, example, one run).
//
// `TerminalView` is rendered to static markup for every screen, with tamper mode on, and with a
// finished proof. The batch holds sentinel digits in its record ids, accounts and salts. Every
// `href` in the markup must be the Verify_Link and nothing else, and no link, form or image
// target may carry a sentinel value. Failure messages hold counts and names only.

const NO_PF = (_pf: PfNumber): void => undefined;

function markupOf(state: TerminalState): string {
  return renderToStaticMarkup(createElement(TerminalView, { state, onPf: NO_PF }));
}

/** Every `href` value in the markup, as written. */
function hrefsOf(markup: string): string[] {
  return Array.from(markup.matchAll(/\bhref="([^"]*)"/g), (m) => m[1] ?? '');
}

// Attributes that can send data somewhere: none may appear with a value in the view.
function navigationAttributes(markup: string): string[] {
  return Array.from(markup.matchAll(/\b(?:src|action|formaction|srcset|ping)="([^"]*)"/g), (m) => m[1] ?? '');
}

function sampleBundle(): ProofBundle {
  const first = fc.sample(proofBundleArb, { seed: 20264400, numRuns: 1 })[0];
  if (first === undefined) throw new Error('FIXTURE: NO BUNDLE');
  return first;
}

const BUNDLE: ProofBundle = sampleBundle();

function screens(): Readonly<Record<string, TerminalState>> {
  return {
    CTM000: initialState(),
    CTM100: onSelectScreen(),
    CTM200: loadedState(GOOD_BATCH),
    'CTM200 tamper': step(loadedState(GOOD_BATCH), pf(12)),
    CTM300: ctm300(GOOD_BATCH),
    'CTM300 done': withDone(ctm300(GOOD_BATCH), BUNDLE),
  };
}

const SENTINEL_VALUES: readonly string[] = GOOD_BATCH.postings.flatMap((p) => [
  String(p.account),
  String(p.salt),
]);

describe('url_holds_only_bundle', () => {
  it('url_holds_only_bundle: no screen has an href, except the Link_Anchor of a finished proof', () => {
    for (const [name, state] of Object.entries(screens())) {
      const hrefs = hrefsOf(markupOf(state));
      if (state.prove.kind === 'done') expect(hrefs, name).toEqual([state.prove.link]);
      else expect(hrefs, name).toEqual([]);
    }
  });

  it('url_holds_only_bundle: the Link_Anchor holds the verify link of the bundle and the same text', () => {
    const state = withDone(ctm300(GOOD_BATCH), BUNDLE);
    const link = verifyLinkFor(BUNDLE);
    const markup = markupOf(state);
    expect(link.startsWith(VERIFY_LINK_PREFIX)).toBe(true);
    expect(hrefsOf(markup)).toEqual([link]);
    expect(markup).toContain('data-testid="verify-link"');
    expect(markup).toContain(`>${link}</a>`);
    expect(markup).toContain('rel="noopener"');
  });

  it('url_holds_only_bundle: no href or other target holds an account or a salt, and no account or salt is drawn', () => {
    for (const [name, state] of Object.entries(screens())) {
      const markup = markupOf(state);
      const targets = [...hrefsOf(markup), ...navigationAttributes(markup)];
      for (const value of SENTINEL_VALUES) {
        expect(targets.some((t) => t.includes(value)), `${name} target`).toBe(false);
        expect(markup.includes(value), `${name} text`).toBe(false);
      }
    }
  });

  it('url_holds_only_bundle: the view has no form, no input and no image', () => {
    for (const [name, state] of Object.entries(screens())) {
      const markup = markupOf(state);
      expect(/<(?:form|input|img|iframe|script)\b/i.test(markup), name).toBe(false);
    }
  });
});
