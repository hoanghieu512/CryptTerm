import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_FORMAT_CODES,
  BundleFormatError,
  bundleToJson,
  decodeBundle,
  encodeBundleForUrl,
} from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { runProperty } from '../support/pbt';
import { BUNDLE_SENTINEL, bundleDefectArb, canonicalText, proofBundleArb } from '../support/bundle-arbitraries';

// Feature: zk-core, Property 5 (decode_roundtrip) and Property 6 (decode_rejects_malformed).
// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5. Synthetic data only.

const URL_FORM = /^[A-Za-z0-9_-]+$/;
const LIMIT_CHARS = 1_048_576;

/** The error a decode throws, or undefined when it returns. */
function decodeError(input: unknown): unknown {
  try {
    decodeBundle(input as string);
    return undefined;
  } catch (error) {
    return error;
  }
}

function checkRoundTrip(b: ProofBundle): void {
  const json = bundleToJson(b);
  const url = encodeBundleForUrl(b);
  // The canonical text is written independently in the support file, and has no whitespace.
  expect(json).toBe(canonicalText(b));
  expect(json).not.toMatch(/\s/);
  // The URL form is base64url of that text and holds only URL-safe characters.
  expect(url).toMatch(URL_FORM);
  expect(url).toBe(Buffer.from(json, 'utf8').toString('base64url'));
  expect(decodeBundle(json)).toStrictEqual(b);
  expect(decodeBundle(url)).toStrictEqual(b);
}

function sampleBundle(): ProofBundle {
  const [b] = fc.sample(proofBundleArb, { seed: 7, numRuns: 1 });
  if (b === undefined) throw new Error('FIXTURE BUNDLE MISSING');
  return b;
}

describe('decode_roundtrip', () => {
  it('decode_roundtrip: JSON text and URL form decode to the same bundle', () => {
    const config = { seed: 20263005, numRuns: 200 };
    runProperty('P5 decode_roundtrip', config, fc.property(proofBundleArb, checkRoundTrip));
  });

  it('decode_roundtrip: surrounding whitespace and indented JSON are accepted', () => {
    const b = sampleBundle();
    const indented = JSON.stringify(JSON.parse(canonicalText(b)), null, 2);
    expect(decodeBundle(`\n  ${bundleToJson(b)} \t\r\n`)).toStrictEqual(b);
    expect(decodeBundle(indented)).toStrictEqual(b);
    expect(decodeBundle(`  ${encodeBundleForUrl(b)}\n`)).toStrictEqual(b);
  });
});

/** Every own value of the error as text, the stack excluded. */
function ownValuesText(error: Error): string {
  const names = Object.getOwnPropertyNames(error).filter((name) => name !== 'stack');
  const record = error as unknown as Record<string, unknown>;
  return JSON.stringify(names.map((name) => String(record[name])));
}

function checkRejected(text: string, code: string): void {
  const error = decodeError(text);
  expect(error).toBeInstanceOf(BundleFormatError);
  const e = error as BundleFormatError;
  expect(e.code).toBe(code);
  expect(BUNDLE_FORMAT_CODES).toContain(e.code);
  // A fixed message means no fragment of the input can be in it.
  expect(e.message).toBe(`BUNDLE FORMAT ERROR ${e.code}`);
  expect(ownValuesText(e)).not.toContain(BUNDLE_SENTINEL);
  expect('cause' in e).toBe(false);
}

describe('decode_rejects_malformed', () => {
  it('decode_rejects_malformed: each planted defect gives its fixed code, as JSON and as URL form', () => {
    const config = { seed: 20263006, numRuns: 200 };
    const check = (defect: { text: string; code: string }): void => {
      checkRejected(defect.text, defect.code);
      checkRejected(Buffer.from(defect.text, 'utf8').toString('base64url'), defect.code);
    };
    runProperty('P6 decode_rejects_malformed', config, fc.property(bundleDefectArb, check));
  });
});

describe('decode_rejects_malformed examples', () => {
  it('decode_rejects_malformed: more than 1,048,576 characters is TOO_LARGE before parsing', () => {
    checkRejected('x'.repeat(2 * LIMIT_CHARS), 'TOO_LARGE');
    checkRejected(' '.repeat(LIMIT_CHARS + 1), 'TOO_LARGE');
    // Exactly at the limit the size rule passes, and the text then fails for another reason.
    const atLimit = decodeError('A'.repeat(LIMIT_CHARS));
    expect(atLimit).toBeInstanceOf(BundleFormatError);
    expect((atLimit as BundleFormatError).code).not.toBe('TOO_LARGE');
  });

  it('decode_rejects_malformed: values that are not text are NOT_TEXT', () => {
    for (const input of [42, null, undefined, {}, [], new Uint8Array(3), true]) {
      checkRejected(input as unknown as string, 'NOT_TEXT');
    }
  });

  it('decode_rejects_malformed: text that is neither JSON nor URL form is SYNTAX', () => {
    for (const input of ['', '   ', '[]', '"x"', 'null', 'not json!', 'abc=', '{']) {
      checkRejected(input, 'SYNTAX');
    }
    checkRejected('{}', 'MISSING_KEY');
  });
});

describe('decode_rejects_malformed hostile input', () => {
  it('decode_rejects_malformed: a __proto__ key is UNKNOWN_KEY and pollutes nothing', () => {
    const base = canonicalText(sampleBundle());
    checkRejected(`${base.slice(0, -1)},"__proto__":{"polluted":1}}`, 'UNKNOWN_KEY');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('decode of a changed URL form', () => {
  it('decode_rejects_malformed: a changed URL form decodes or throws a BundleFormatError only', () => {
    const url = encodeBundleForUrl(sampleBundle());
    const replacements = [...'AZaz09-_=!{ '];
    const draw = fc.tuple(fc.nat({ max: url.length - 1 }), fc.constantFrom(...replacements));
    const check = ([index, char]: readonly [number, string]): void => {
      const error = decodeError(url.slice(0, index) + char + url.slice(index + 1));
      if (error !== undefined) expect(error).toBeInstanceOf(BundleFormatError);
    };
    runProperty('P6 changed url', { seed: 20263007, numRuns: 200 }, fc.property(draw, check));
  });
});
