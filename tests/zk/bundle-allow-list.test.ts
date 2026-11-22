import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIELD_MODULUS } from '../../src/ledger/field';
import { BUNDLE_KEYS, BundleFormatError, bundleToJson, rootToDigestHex } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { runProperty } from '../support/pbt';
import { PLAIN_KEY_ORDER, proofBundleArb } from '../support/bundle-arbitraries';

// Feature: zk-core, Property 3, codec half (bundle_allow_list). Validates: Requirements 5.1, 5.4.
// The half that runs proveBatch on a stub is added in group 3. Synthetic data only.

// The ten JSON keys and the TypeScript field behind each, written out here on purpose and not
// read from the codec. Each entry is "json_key:tsField".
const KEY_TABLE = [
  'batch_id:batchId', 'record_count:recordCount', 'merkle_root:merkleRoot',
  'limit_cents:limitCents', 'signature:signature', 'source_key_id:sourceKeyId',
  'proof:proof', 'circuit_version:circuitVersion', 'verification_key_hash:vkHash',
  'public_inputs:publicInputs',
].map((entry) => entry.split(':') as [string, string]);
const ALLOW_LIST = KEY_TABLE.map(([json]) => json);

function keysOf(b: ProofBundle): string[] {
  return Object.keys(JSON.parse(bundleToJson(b)) as Record<string, unknown>);
}

describe('bundle_allow_list', () => {
  it('bundle_allow_list: BUNDLE_KEYS is the ten-row key table in order', () => {
    expect(BUNDLE_KEYS.map((row) => [row.json, row.field])).toStrictEqual(KEY_TABLE);
    expect(PLAIN_KEY_ORDER).toStrictEqual(ALLOW_LIST);
  });

  it('bundle_allow_list: the JSON keys equal the allow-list in order, for every bundle', () => {
    const config = { seed: 20263003, numRuns: 100 };
    runProperty('P3 bundle_allow_list codec', config, fc.property(proofBundleArb, (b) => {
      expect(keysOf(b)).toStrictEqual(ALLOW_LIST);
    }));
  });
});

function firstBundle(): ProofBundle {
  const [b] = fc.sample(proofBundleArb, { seed: 11, numRuns: 1 });
  if (b === undefined) throw new Error('FIXTURE BUNDLE MISSING');
  return b;
}

describe('bundle_allow_list extras', () => {
  it('bundle_allow_list: fields outside the type are never written', () => {
    const polluted = { ...firstBundle(), privateKey: 'k', postings: [1n], note: 'n' };
    expect(keysOf(polluted as ProofBundle)).toStrictEqual(ALLOW_LIST);
    expect(bundleToJson(polluted as ProofBundle)).not.toMatch(/privateKey|postings|note/);
  });
});

describe('bundle_allow_list invalid bundles', () => {
  it('bundle_allow_list: an invalid bundle throws a BundleFormatError', () => {
    const good = firstBundle();
    const broken: ProofBundle[] = [
      { ...good, recordCount: 0 },
      { ...good, merkleRoot: FIELD_MODULUS },
      { ...good, limitCents: 2n ** 40n },
      { ...good, proof: new Uint8Array(31) },
      { ...good, publicInputs: ['1', '2', '03'] },
    ];
    for (const bundle of broken) {
      expect(() => bundleToJson(bundle)).toThrow(BundleFormatError);
    }
  });
});

describe('rootToDigestHex', () => {
  it('rootToDigestHex: 0x and 64 lowercase hex characters', () => {
    expect(rootToDigestHex(0n)).toBe(`0x${'0'.repeat(64)}`);
    expect(rootToDigestHex(255n)).toBe(`0x${'0'.repeat(62)}ff`);
    const top = rootToDigestHex(FIELD_MODULUS - 1n);
    expect(top).toMatch(/^0x[0-9a-f]{64}$/);
    expect(BigInt(top)).toBe(FIELD_MODULUS - 1n);
  });
});
