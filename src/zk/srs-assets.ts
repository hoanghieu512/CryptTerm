// Vite asset imports for the vendored SRS. `.dat` is not a known asset extension,
// so the `?url` part is required (a bare `?no-inline` fails to load). `no-inline`
// makes Vite emit a real file for `g2.dat` (128 bytes, below the default 4 KiB
// inline limit) instead of a data URL, so the worker fetches both files from the
// page's own origin.
import g1Url from './artifacts/srs/g1.dat?url&no-inline';
import g2Url from './artifacts/srs/g2.dat?url&no-inline';
import manifestJson from './artifacts/srs/srs.sha256.json';
import { parseSrsManifest } from './srs';
import type { SrsManifest } from './srs';

export const SRS_URLS: { readonly g1: string; readonly g2: string } = {
  g1: g1Url,
  g2: g2Url,
};

export const SRS_MANIFEST: SrsManifest = parseSrsManifest(manifestJson);
