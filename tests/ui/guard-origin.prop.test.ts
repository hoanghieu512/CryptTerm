import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isLocalOrigin } from '../../e2e/base-url';
import { runProperty } from '../support/pbt';
// Feature: release, Property 2: The route guard is exact about the configured origin
// **Validates: Requirements 2.7, 6.1**
//
// Seed 20264202, 300 runs. For a generated base origin and a generated request URL, the guard
// lets the request through when the URL is a blob: or data: URL or has the same origin, and
// blocks it in every other case, including a URL that does not parse. Strings are synthetic.
const labelArb = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
const originArb: fc.Arbitrary<string> = fc
  .record({
    scheme: fc.constantFrom('http', 'https'),
    host: fc.array(labelArb, { minLength: 1, maxLength: 3 }).map((labels) => labels.join('.')),
    port: fc.option(fc.integer({ min: 1024, max: 65535 }), { nil: undefined }),
  })
  .map(({ scheme, host, port }) => `${scheme}://${host}${port === undefined ? '' : `:${port}`}`);
const suffixArb = fc.stringMatching(/^(\/[a-z0-9._-]{0,8}){0,3}(\?[a-z0-9=&]{0,8})?(#[a-z0-9=]{0,8})?$/);
type Case = { readonly origin: string; readonly url: string; readonly local: boolean };
const sameOriginArb: fc.Arbitrary<Case> = fc
  .tuple(originArb, suffixArb)
  .map(([origin, suffix]) => ({ origin, url: `${origin}${suffix}`, local: true }));
const foreignOriginArb: fc.Arbitrary<Case> = fc
  .tuple(originArb, originArb, suffixArb)
  .filter(([origin, other]) => new URL(origin).origin !== new URL(other).origin)
  .map(([origin, other, suffix]) => ({ origin, url: `${other}${suffix}`, local: false }));
const blobOrDataArb: fc.Arbitrary<Case> = fc
  .tuple(originArb, fc.constantFrom('blob:', 'data:'), fc.stringMatching(/^[a-z0-9/:;,=.-]{0,20}$/))
  .map(([origin, scheme, rest]) => ({ origin, url: `${scheme}${rest}`, local: true }));
const unparseableArb: fc.Arbitrary<Case> = fc
  .tuple(originArb, fc.string({ maxLength: 20 }))
  .filter(([, s]) => !URL.canParse(s) && !s.startsWith('blob:') && !s.startsWith('data:'))
  .map(([origin, url]) => ({ origin, url, local: false }));
const caseArb: fc.Arbitrary<Case> = fc.oneof(sameOriginArb, foreignOriginArb, blobOrDataArb, unparseableArb);
describe('route_guard_exact_origin', () => {
  it('route_guard_exact_origin: local exactly for the same origin, blob: and data:', () => {
    runProperty('route_guard_exact_origin', { seed: 20264202, numRuns: 300 }, fc.property(caseArb, (c) => {
      expect(isLocalOrigin(c.url, c.origin)).toBe(c.local);
    }));
  });
});
