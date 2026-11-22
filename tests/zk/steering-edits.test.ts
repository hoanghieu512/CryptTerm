import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Feature: zk-core, task 0 (steering_edits_present). tech.md lists FORMAT as the first verifier
// step and the public_inputs field of the bundle, and noir.md records the VK_HASH rule.

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../.kiro/steering/${name}`, import.meta.url)), 'utf8');

/** The text of one `## ` section, up to the next `## ` heading. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start < 0) return '';
  const rest = text.slice(start + 3);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

const STEPS = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'];

describe('steering_edits_present', () => {
  it('steering_edits_present: tech.md lists the six verifier steps, FORMAT first', () => {
    const order = section(read('tech.md'), 'Verifier order');
    expect(order).not.toBe('');
    const numbered = order.split('\n').filter((line) => /^\d+\. /.test(line));
    expect(numbered).toHaveLength(STEPS.length);
    STEPS.forEach((step, i) => expect(numbered[i]).toMatch(new RegExp(`^${i + 1}\\. \`${step}\``)));
  });

  it('steering_edits_present: tech.md Proof bundle names public_inputs', () => {
    expect(section(read('tech.md'), 'Proof bundle')).toContain('`public_inputs`');
  });

  it('steering_edits_present: noir.md records how VK_HASH is derived', () => {
    const noir = read('noir.md');
    for (const piece of ['`VK_HASH`', '`circuitComputeVk`', '`PROOF_SETTINGS`', '3680', '`vk.hash`']) {
      expect(noir).toContain(piece);
    }
  });
});
