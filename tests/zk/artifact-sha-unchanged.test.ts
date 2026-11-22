import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Feature: zk-core, Requirement 2.4. The new nargo tests must not change the committed Artifact.
// The full hash is written out here on purpose, so that a rebuilt Artifact cannot move it.
const EXPECTED_SHA256 = '2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b';

const ARTIFACT_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.json', import.meta.url),
);
const META_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.meta.json', import.meta.url),
);

describe('artifact_sha_unchanged', () => {
  it('artifact_sha_unchanged: the committed Artifact bytes hash to the expected sha256', () => {
    const digest = createHash('sha256').update(readFileSync(ARTIFACT_PATH)).digest('hex');
    expect(digest).toBe(EXPECTED_SHA256);
  });

  it('artifact_sha_unchanged: ledger_audit.meta.json records the same sha256', () => {
    const meta: unknown = JSON.parse(readFileSync(META_PATH, 'utf8'));
    expect(meta).toEqual({
      nargoVersion: 'nargo version = 1.0.0',
      artifactSha256: EXPECTED_SHA256,
    });
  });
});
