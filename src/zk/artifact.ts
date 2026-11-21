// The compiled `ledger_audit` Artifact as the browser gets it.
//
// The Artifact is a public build output (no private data). Vite emits it as a real
// file next to the page (`?url&no-inline`), and the worker fetches it from the origin
// that serves the Spike_Page (Requirements 8.11, 10.2). This module imports no
// runtime code besides that URL, so it works in the worker and in Node tests.
import artifactUrl from './artifacts/ledger_audit.json?url&no-inline';
import type { CompiledCircuit } from '@noir-lang/types';

/** The shape `Noir` accepts: `@noir-lang/types` `CompiledCircuit`. */
export type CompiledArtifact = CompiledCircuit;

/** URL of the emitted Artifact file (a string, not the parsed JSON). */
export const ARTIFACT_URL: string = artifactUrl;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks the top-level fields `CompiledCircuit` (`@noir-lang/types` 1.0.0) requires and
 * narrows the parsed JSON. The inner shape of `abi`, `debug_symbols` and `file_map` is
 * checked by `noir_js` itself when it encodes inputs. Throws a plain `Error` with a
 * fixed message that carries no value from the input.
 */
export function assertCompiledArtifact(value: unknown): asserts value is CompiledArtifact {
  if (
    !isRecord(value) ||
    typeof value['bytecode'] !== 'string' ||
    value['bytecode'].length === 0 ||
    !isRecord(value['abi']) ||
    typeof value['debug_symbols'] !== 'string' ||
    !isRecord(value['file_map'])
  ) {
    throw new Error('ARTIFACT INVALID');
  }
}

// Same rule as `fetchSrsSource` in `srs.ts`, duplicated here so this task edits no
// existing file. When a page or worker `location` exists, a URL of another origin is
// refused before any request. Node has no `location`, so any URL passes there.
function assertSameOrigin(url: string): void {
  const location = (globalThis as { location?: { origin?: string; href?: string } }).location;
  if (location?.origin === undefined) return;
  let target: URL;
  try {
    target = new URL(url, location.href ?? location.origin);
  } catch {
    throw new Error('ARTIFACT FETCH FAILED');
  }
  if (target.origin !== location.origin) {
    throw new Error('ARTIFACT URL NOT SAME ORIGIN');
  }
}

/**
 * Fetches the Artifact with a plain GET (no body, default credentials) and returns it
 * once it passes `assertCompiledArtifact`. Throws `ARTIFACT URL NOT SAME ORIGIN` before
 * any request for a cross-origin URL, `ARTIFACT FETCH FAILED` for a network error or a
 * non-OK response, and `ARTIFACT INVALID` for unparsable or malformed JSON.
 */
export async function loadArtifactFromUrl(url: string): Promise<CompiledArtifact> {
  assertSameOrigin(url);
  let text: string;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('ARTIFACT FETCH FAILED');
    text = await response.text();
  } catch {
    throw new Error('ARTIFACT FETCH FAILED');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('ARTIFACT INVALID');
  }
  assertCompiledArtifact(parsed);
  return parsed;
}
