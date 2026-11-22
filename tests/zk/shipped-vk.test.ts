import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VK_BYTE_LENGTH, VK_HASH } from '../../src/zk/circuit-identity';
import { assertShippedVk } from '../../src/zk/circuit-vk';
import { sha256Hex } from '../../src/zk/sha256';

// Feature: zk-core, Requirement 7.4, the part that needs no proving (shipped_vk_file_checks).
// The comparison with the key that the prover returns is shipped_vk_matches_prover_vk (group 4).
const VK_PATH = fileURLToPath(new URL('../../src/zk/artifacts/ledger_audit.vk', import.meta.url));
const FIXED_MESSAGE = 'SHIPPED VERIFICATION KEY INVALID';

const shipped = (): Uint8Array => new Uint8Array(readFileSync(VK_PATH));

describe('shipped_vk_file_checks', () => {
  it('shipped_vk_file_checks: the file is 3680 bytes and hashes to VK_HASH', async () => {
    const bytes = shipped();
    expect(bytes.length).toBe(VK_BYTE_LENGTH);
    expect(bytes.length).toBe(3680);
    expect(await sha256Hex(bytes)).toBe(VK_HASH);
  });

  it('shipped_vk_file_checks: assertShippedVk accepts the shipped bytes', async () => {
    await expect(assertShippedVk(shipped())).resolves.toBeUndefined();
  });
});

describe('shipped_vk_file_checks rejections', () => {
  it('shipped_vk_file_checks: a changed, short or long key is refused with a fixed message', async () => {
    const good = shipped();
    const flipped = good.slice();
    flipped[100] = (flipped[100] ?? 0) ^ 1;
    const candidates = [flipped, good.slice(0, 3679), new Uint8Array(0), new Uint8Array(3681)];
    for (const bytes of candidates) {
      await expect(assertShippedVk(bytes)).rejects.toThrow(FIXED_MESSAGE);
    }
  });
});
