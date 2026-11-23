import { describe, expect, it } from 'vitest';
import type { SignedDigest } from '../../src/ledger/digest';
import { TRUSTED_SOURCE_KEYS } from '../../src/ledger/trusted-keys';
import { renderGrid } from '../../src/ui/model/grid';
import { checkSignature } from '../../src/ui/model/digest-status';
import { TINY_BATCH, committedSample, editSlot, loadedState } from '../support/terminal-arbitraries';

// digest_status: the signature status always names the original batch, and TAMPERED sits on the
// same row once the Working_Batch differs. No text claims the edited batch matches the root.

const NAMES = ['clean', 'over-limit-unflagged', 'unbalanced', 'large'];
const VALID = 'SIGNATURE VALID (ORIGINAL BATCH)';
const INVALID = 'SIGNATURE INVALID (ORIGINAL BATCH)';
/** Row 3 of the grid (index 2). */
const rowThree = (rows: readonly string[]): string => rows[2] ?? '';

function withKeyId(digest: SignedDigest, sourceKeyId: string): SignedDigest {
  return { ...digest, sourceKeyId };
}

function flipSignatureByte(digest: SignedDigest): SignedDigest {
  const first = digest.signature.startsWith('0') ? '1' : '0';
  return { ...digest, signature: `${first}${digest.signature.slice(1)}` };
}

describe('digest_status: checkSignature', () => {
  it.each(NAMES)('digest_status: the committed digest of %s is valid', async (name) => {
    expect(await checkSignature(committedSample(name).digest)).toBe(true);
  });

  it('digest_status: an unknown key id, __proto__ and a flipped signature byte are invalid', async () => {
    const digest = committedSample('clean').digest;
    expect(await checkSignature(withKeyId(digest, 'DEMO-0000000000000000'))).toBe(false);
    expect(await checkSignature(withKeyId(digest, '__proto__'))).toBe(false);
    expect(await checkSignature(withKeyId(digest, 'constructor'))).toBe(false);
    expect(await checkSignature(flipSignatureByte(digest))).toBe(false);
  });

  it('digest_status: the key lookup uses own properties only', async () => {
    const digest = committedSample('clean').digest;
    const inherited = Object.create({ [digest.sourceKeyId]: TRUSTED_SOURCE_KEYS[digest.sourceKeyId] }) as Record<string, string>;
    expect(await checkSignature(digest, inherited)).toBe(false);
    expect(await checkSignature(digest, {})).toBe(false);
    expect(await checkSignature(digest, TRUSTED_SOURCE_KEYS)).toBe(true);
  });

  it('digest_status: a value of the wrong shape gives false and never throws', async () => {
    for (const bad of [null, undefined, 7, 'x', [], {}, { batchId: 1 }]) {
      expect(await checkSignature(bad)).toBe(false);
    }
  });
});

describe('digest_status: row 3 of CTM200', () => {
  it('digest_status: the row names the original batch for a valid and an invalid signature', () => {
    expect(rowThree(renderGrid(loadedState(TINY_BATCH, true)))).toContain(VALID);
    const invalid = rowThree(renderGrid(loadedState(TINY_BATCH, false)));
    expect(invalid).toContain(INVALID);
    expect(invalid).not.toContain(VALID);
  });

  it('digest_status: after an edit row 3 keeps its text and adds TAMPERED at column 40', () => {
    for (const valid of [true, false]) {
      const before = loadedState(TINY_BATCH, valid);
      const rowBefore = rowThree(renderGrid(before));
      expect(rowBefore).not.toContain('TAMPERED');
      const after = editSlot(before, 0, 101n);
      expect(after.sample?.batch).toStrictEqual(TINY_BATCH);
      const rowAfter = rowThree(renderGrid(after));
      expect(rowAfter.slice(39, 47)).toBe('TAMPERED');
      expect(rowAfter.slice(0, 39)).toBe(rowBefore.slice(0, 39));
      expect(rowAfter).toContain(valid ? VALID : INVALID);
      expect(rowAfter).toContain('(ORIGINAL BATCH)');
    }
  });

  it('digest_status: no row claims that the edited batch matches the signed root', () => {
    const after = editSlot(loadedState(TINY_BATCH, true), 0, 101n);
    const text = renderGrid(after).join('\n');
    expect(text).not.toMatch(/MATCH|VERIFIED|ROOT|SIGNED BATCH/);
  });
});
