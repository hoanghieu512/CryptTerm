import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, hasBaseUrl, isLocalOrigin, resolveBaseUrl } from '../../e2e/base-url';
// Test guard_base_url (release Requirements 6.1, 6.2): the e2e target origin comes from BASE_URL
// when it is set, else the loopback preview origin, and the Route_Guard rule is exact about it.
const DRAFT = 'https://draft-1234--example.netlify.app';
describe('guard_base_url', () => {
  it('uses the loopback preview origin and starts a local server when BASE_URL is unset or blank', () => {
    expect(resolveBaseUrl({})).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl({ BASE_URL: '  ' })).toBe(DEFAULT_BASE_URL);
    expect(hasBaseUrl({})).toBe(false);
    expect(hasBaseUrl({ BASE_URL: '' })).toBe(false);
  });
  it('uses only the origin of BASE_URL when it is set, with no path and no trailing slash', () => {
    expect(resolveBaseUrl({ BASE_URL: DRAFT })).toBe(DRAFT);
    expect(resolveBaseUrl({ BASE_URL: `${DRAFT}/some/path?x=1#y` })).toBe(DRAFT);
    expect(hasBaseUrl({ BASE_URL: DRAFT })).toBe(true);
  });
  it('rejects an unparseable BASE_URL', () => {
    expect(() => resolveBaseUrl({ BASE_URL: 'not a url' })).toThrow('BASE_URL INVALID');
  });
  it('allows exactly the configured origin, and blob: and data: URLs', () => {
    expect(isLocalOrigin(`${DRAFT}/verify#b=abc`, DRAFT)).toBe(true);
    expect(isLocalOrigin(`${DRAFT}/favicon.ico`, DRAFT)).toBe(true);
    expect(isLocalOrigin('blob:null/abc', DRAFT)).toBe(true);
    expect(isLocalOrigin('data:text/plain,x', DRAFT)).toBe(true);
    expect(isLocalOrigin(`${DEFAULT_BASE_URL}/`, DRAFT)).toBe(false);
    expect(isLocalOrigin('https://draft-1234--example.netlify.app.evil.test/', DRAFT)).toBe(false);
    expect(isLocalOrigin('http://draft-1234--example.netlify.app/', DRAFT)).toBe(false);
    expect(isLocalOrigin('not a url', DRAFT)).toBe(false);
    expect(isLocalOrigin('', DRAFT)).toBe(false);
  });
});
