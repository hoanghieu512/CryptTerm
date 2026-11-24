import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMIT_CENTS } from '../../src/ledger/invariants';
import { MESSAGES } from '../../src/ui/model/messages';
import { startStateFrom } from '../../src/ui/model/start';
import type { LocationLike } from '../../src/ui/model/start';
import { runProperty } from '../support/pbt';
import { step } from '../support/terminal-arbitraries';

// Group 1 tests of the verifier spec: the route choice (Requirement 1.1) and the one read of the
// URL fragment (Requirements 3.1, 3.2). The location is a fake that counts reads, so a test can
// assert "read once". Strings are synthetic. Nothing here prints anything.

interface CountingLocation {
  readonly loc: LocationLike;
  readonly reads: { pathname: number; hash: number };
  /** Changes the fragment after the page "loaded". */
  setHash(hash: string): void;
}

function fakeLocation(pathname: string, hash: string): CountingLocation {
  const reads = { pathname: 0, hash: 0 };
  let currentHash = hash;
  const loc: LocationLike = {
    get pathname(): string {
      reads.pathname += 1;
      return pathname;
    },
    get hash(): string {
      reads.hash += 1;
      return currentHash;
    },
  };
  return {
    loc,
    reads,
    setHash(next) {
      currentHash = next;
    },
  };
}

const VERIFY_PATH = '/verify';

// Pathnames: random strings, and strings built around `/verify` so that near misses are common.
const pathnameArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 20 }),
  fc.constantFrom('/', '', '/verify', '/verify/', '/verifyx', '/VERIFY', '/Verify', '/verify/x', '//verify', ' /verify', '/verify '),
  fc.string({ maxLength: 8 }).map((s) => `${VERIFY_PATH}${s}`),
  fc.string({ maxLength: 8 }).map((s) => `${s}${VERIFY_PATH}`),
);

describe('verify_route_choice', () => {
  // Feature: verifier, Property 1: Route choice
  // **Validates: Requirements 1.1**
  it('verify_route_choice: the start screen is CTM900 if and only if the pathname is exactly /verify', () => {
    runProperty('verify_route_choice', { seed: 20264901, numRuns: 200 }, fc.property(pathnameArb, fc.string({ maxLength: 12 }), (pathname, hash) => {
      const at = fakeLocation(pathname, hash);
      const state = startStateFrom(at.loc);
      expect(state.screen === 'CTM900').toBe(pathname === VERIFY_PATH);
      if (pathname !== VERIFY_PATH) expect(state.screen).toBe('CTM000');
      // The pathname is read once, and the fragment at most once.
      expect(at.reads.pathname).toBe(1);
      expect(at.reads.hash).toBeLessThanOrEqual(1);
    }));
  });

  it.each([
    ['/', 'CTM000'],
    ['/verify', 'CTM900'],
    ['/verify/', 'CTM000'],
    ['/verifyx', 'CTM000'],
    ['/VERIFY', 'CTM000'],
    ['/verify/x', 'CTM000'],
  ] as const)('verify_route_choice: %j starts on %s', (pathname, screen) => {
    expect(startStateFrom(fakeLocation(pathname, '').loc).screen).toBe(screen);
  });

  it('verify_route_choice: /verify starts with the limit field prefilled and the cursor in it', () => {
    const state = startStateFrom(fakeLocation('/verify', '').loc);
    expect(state.fields.limit).toBe(LIMIT_CENTS.toString());
    expect(state.cursor).toEqual({ fieldId: 'limit', offset: 0 });
    // The cursor is real: the first typed digit lands in the field, as `settle` guarantees.
    const typed = step(state, { type: 'CHAR', ch: '5' });
    expect(typed.fields.limit).toBe(`5${LIMIT_CENTS.toString().slice(1)}`);
  });

  it('verify_route_choice: any other path starts the plain logon state', () => {
    const state = startStateFrom(fakeLocation('/', '#b=abc').loc);
    expect(state.screen).toBe('CTM000');
    expect(state.cursor).toBeNull();
    expect(state.status).toBe('');
  });
});

/** True for a fragment that is `#b=` followed by at least one character. */
function isLinkHash(hash: string): boolean {
  return hash.startsWith('#b=') && hash.length > 3;
}

// Fragments: random text, `#b=` plus random text, `#` plus random text, and the near misses.
const hashArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 30 }),
  fc.string({ maxLength: 30 }).map((s) => `#b=${s}`),
  fc.string({ maxLength: 30 }).map((s) => `#${s}`),
  fc.constantFrom('', '#', '#b', '#b=', '#b=a', '#x=abc', '#B=abc', '#b =abc', ' #b=abc', '#b=%20', '##b=abc'),
);

describe('verify_hash_source', () => {
  // Feature: verifier, Property 6: Fragment source
  // **Validates: Requirements 3.1, 3.2**
  it('verify_hash_source: LINK with the text after #b= if and only if the fragment is #b= plus at least one character', () => {
    runProperty('verify_hash_source', { seed: 20264906, numRuns: 200 }, fc.property(hashArb, (hash) => {
      const at = fakeLocation(VERIFY_PATH, hash);
      const state = startStateFrom(at.loc);
      expect(state.screen).toBe('CTM900');
      if (isLinkHash(hash)) {
        expect(state.verify.source).toBe('LINK');
        expect(state.verify.bundleText).toBe(hash.slice(3));
        expect(state.verify.bundleSeq).toBe(1);
        expect(state.status).toBe(MESSAGES.BUNDLE_READY);
      } else {
        expect(state.verify.source).toBe('NONE');
        expect(state.verify.bundleText).toBe('');
        expect(state.verify.bundleSeq).toBe(0);
        expect(state.status).toBe('');
      }
      expect(state.verify.pendingRead).toBeNull();
      expect(state.verify.run).toBeNull();
      expect(state.verify.result).toBeNull();
      // The limit field is the default in every case, and the location is read once for each part.
      expect(state.fields.limit).toBe(LIMIT_CENTS.toString());
      expect(at.reads).toEqual({ pathname: 1, hash: 1 });
    }));
  });

  it.each([
    ['#x=abc', 'a different key'],
    ['#B=abc', 'a capital key'],
    ['#b', 'no equals sign'],
    ['#b=', 'no text after the equals sign'],
    ['', 'an empty fragment'],
  ])('verify_hash_source: %j (%s) keeps source NONE and an empty text', (hash) => {
    const state = startStateFrom(fakeLocation(VERIFY_PATH, hash).loc);
    expect(state.verify.source).toBe('NONE');
    expect(state.verify.bundleText).toBe('');
  });

  it('verify_hash_source: #b=abc gives LINK and the text abc', () => {
    const state = startStateFrom(fakeLocation(VERIFY_PATH, '#b=abc').loc);
    expect(state.verify.source).toBe('LINK');
    expect(state.verify.bundleText).toBe('abc');
  });

  it('verify_hash_source: a fragment change after the load changes nothing and causes no second read', () => {
    const at = fakeLocation(VERIFY_PATH, '#b=first');
    const state = startStateFrom(at.loc);
    expect(at.reads).toEqual({ pathname: 1, hash: 1 });

    at.setHash('#b=second');
    // Acting on the state afterwards does not look at the location again.
    const later = step(step(state, { type: 'CHAR', ch: '1' }), { type: 'BACKSPACE' });
    expect(later.verify.bundleText).toBe('first');
    expect(later.verify.source).toBe('LINK');
    expect(at.reads).toEqual({ pathname: 1, hash: 1 });

    // A fragment that was empty at load stays empty, too.
    const none = fakeLocation(VERIFY_PATH, '');
    const noneState = startStateFrom(none.loc);
    none.setHash('#b=late');
    expect(step(noneState, { type: 'CHAR', ch: '1' }).verify.source).toBe('NONE');
    expect(none.reads).toEqual({ pathname: 1, hash: 1 });
  });
});
