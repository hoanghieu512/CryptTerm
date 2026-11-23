// Sample_Loader (terminal-ui design, section H). It downloads one signed sample from the app's own
// origin and uploads nothing. This file holds the only `fetch` call under `src/ui`.
//
// The two URLs are built from the `SAMPLES` table, never from typed text. Any defect (a name that
// is not in the table, a failed request, a response that is not ok, a batch that `parseBatch`
// refuses, a digest that is not JSON of the exact shape) rejects with the fixed message below. The
// rejection holds no response text and no thrown message.
import type { Batch } from '../ledger/batch';
import type { SignedDigest } from '../ledger/digest';
import { isSignedDigestShape } from '../ledger/digest-shape';
import { parseBatch } from '../ledger/parse';
import { SAMPLES } from './model/samples';
import type { SampleName } from './model/samples';

export type FetchLike = (url: string) => Promise<{ readonly ok: boolean; text(): Promise<string> }>;

export interface LoadedFiles {
  readonly batch: Batch;
  /** Frozen: it is the Original_Digest of the session. */
  readonly digest: SignedDigest;
}

export type SampleLoader = (name: SampleName) => Promise<LoadedFiles>;

export const SAMPLE_LOAD_FAILED = 'SAMPLE LOAD FAILED';

export function createSampleLoader(fetchFn: FetchLike = (url) => fetch(url)): SampleLoader {
  return async (name) => {
    try {
      const entry = SAMPLES.find((s) => s.name === name);
      if (entry === undefined) throw new Error(SAMPLE_LOAD_FAILED);
      const [batchResponse, digestResponse] = await Promise.all([
        fetchFn(`/samples/${entry.name}.dat`),
        fetchFn(`/samples/${entry.name}.digest.json`),
      ]);
      if (!batchResponse.ok || !digestResponse.ok) throw new Error(SAMPLE_LOAD_FAILED);
      const batch = parseBatch(await batchResponse.text());
      const digest: unknown = JSON.parse(await digestResponse.text());
      if (!isSignedDigestShape(digest)) throw new Error(SAMPLE_LOAD_FAILED);
      return { batch, digest: Object.freeze({ ...digest }) };
    } catch {
      throw new Error(SAMPLE_LOAD_FAILED);
    }
  };
}
