// The one place that reads BASE_URL for the e2e tooling (release design, "BASE_URL: one resolver,
// two readers"). `playwright.config.ts` and `e2e/helpers.ts` both import from here. This file holds
// no Playwright import, so Vitest can test it.

export const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';

type Env = Readonly<Record<string, string | undefined>>;

/** True when BASE_URL is set to a non-empty value, so the run targets an existing deployment. */
export function hasBaseUrl(env: Env = process.env): boolean {
  const value = env['BASE_URL'];
  return value !== undefined && value.trim() !== '';
}

/**
 * The origin that the e2e run targets: the origin of BASE_URL when it is set, else the loopback
 * preview origin. The result has no path and no trailing slash, so `ORIGIN + '/verify#b=...'`
 * is a valid URL. An unparseable BASE_URL throws.
 */
export function resolveBaseUrl(env: Env = process.env): string {
  if (!hasBaseUrl(env)) return DEFAULT_BASE_URL;
  const raw = (env['BASE_URL'] ?? '').trim();
  if (!URL.canParse(raw)) throw new Error('BASE_URL INVALID: NOT A URL');
  const { origin } = new URL(raw);
  if (origin === 'null') throw new Error('BASE_URL INVALID: NO ORIGIN');
  return origin;
}

/**
 * The rule of the Route_Guard. A request is local when its URL is a blob: or data: URL, or when
 * its origin equals `origin`. Anything that does not parse as a URL is not local, so the guard
 * aborts and records it and never lets it through.
 */
export function isLocalOrigin(url: string, origin: string): boolean {
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  if (!URL.canParse(url) || !URL.canParse(origin)) return false;
  return new URL(url).origin === new URL(origin).origin;
}
