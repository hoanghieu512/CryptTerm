import { describe, expect, it } from 'vitest';
import { parseBatch } from '../../src/ledger/parse';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { layoutOf } from '../../src/ui/model/screens/index';
import { SAMPLES } from '../../src/ui/model/samples';
import type { SampleName } from '../../src/ui/model/samples';
import { createSampleLoader } from '../../src/ui/sample-loader';
import { SENTINEL } from '../support/ledger-arbitraries';
import { update } from '../../src/ui/model/update';
import { ENTER, committedSample, fakeFetch, onSelectScreen, step, typeText } from '../support/terminal-arbitraries';
import type { FakeServed } from '../support/terminal-arbitraries';

// Samples are served as static files. The fake fetch reads the committed files and records URLs.

const EXPECTED_NAMES = ['clean', 'over-limit-unflagged', 'unbalanced', 'large'];

describe('batch_select_lists_samples', () => {
  it('batch_select_lists_samples: CTM100 lists the four samples with a number and one select field', () => {
    expect(SAMPLES.map((s) => s.name)).toEqual(EXPECTED_NAMES);
    const rows = renderGrid(onSelectScreen());
    SAMPLES.forEach((s, i) => {
      const row = rows.find((r) => r.includes(s.label));
      expect(row, `row for ${s.name}`).toBeDefined();
      expect(row?.trimStart().startsWith(String(i + 1))).toBe(true);
    });
    const inputs = layoutOf(onSelectScreen()).fields.filter((f) => f.kind === 'input');
    expect(inputs.map((f) => (f.kind === 'input' ? f.id : ''))).toEqual(['select']);
  });

  it('batch_select_lists_samples: a valid selection emits one LOAD_SAMPLE for that sample', () => {
    SAMPLES.forEach((s) => {
      const out = update(typeText(onSelectScreen(), s.no), ENTER);
      expect(out.effects).toEqual([{ type: 'LOAD_SAMPLE', loadId: 1, name: s.name }]);
    });
  });
});

describe('sample_load', () => {
  it.each(EXPECTED_NAMES)('sample_load: %s parses and requests only its two files', async (name) => {
    const fake = fakeFetch();
    const loaded = await createSampleLoader(fake.fetch)(name as SampleName);
    const disk = committedSample(name);
    expect(loaded.batch).toStrictEqual(parseBatch(disk.text));
    expect(loaded.digest).toStrictEqual(disk.digest);
    expect(Object.isFrozen(loaded.digest)).toBe(true);
    expect([...fake.urls].sort()).toEqual([`/samples/${name}.dat`, `/samples/${name}.digest.json`].sort());
    expect(fake.urls.every((u) => u.startsWith('/samples/') && !u.includes('//'))).toBe(true);
  });

  it('sample_load: a name outside the SAMPLES table makes no request', async () => {
    const fake = fakeFetch();
    const loader = createSampleLoader(fake.fetch);
    for (const bad of ['../secret', '__proto__', 'clean ', '']) {
      await expect(loader(bad as SampleName)).rejects.toBeDefined();
    }
    expect(fake.urls).toEqual([]);
  });
});

describe('sample_load_failure', () => {
  const dat = '/samples/clean.dat';
  const digest = '/samples/clean.digest.json';
  const goodDigest = JSON.stringify(committedSample('clean').digest);
  const cases: readonly (readonly [string, Record<string, FakeServed>])[] = [
    ['the batch request fails', { [dat]: { throws: true } }],
    ['the digest request fails', { [digest]: { throws: true } }],
    ['the batch response is not ok', { [dat]: { notOk: true } }],
    ['the digest response is not ok', { [digest]: { notOk: true } }],
    ['the batch text fails parseBatch', { [dat]: `NOT A BATCH ${SENTINEL}\n` }],
    ['the digest is not JSON', { [digest]: `{ ${SENTINEL}` }],
    ['the digest has the wrong shape', { [digest]: JSON.stringify({ extra: SENTINEL }) }],
    ['the digest has an extra key', { [digest]: goodDigest.replace('{', `{"x":"${SENTINEL}",`) }],
  ];

  it.each(cases)('sample_load_failure: %s', async (_label, planted) => {
    const loader = createSampleLoader(fakeFetch(planted).fetch);
    const failure: unknown = await loader('clean').then(
      () => null,
      (e: unknown) => e ?? 'EMPTY REJECTION',
    );
    expect(failure).not.toBeNull();
    const text = failure instanceof Error ? failure.message : String(failure);
    expect(text).toBe('SAMPLE LOAD FAILED');
    expect(text).not.toContain(SENTINEL);
  });

  it('sample_load_failure: the model shows a fixed text and stays on CTM100', () => {
    const loading = step(typeText(onSelectScreen(), '1'), ENTER);
    const failed = step(loading, { type: 'SAMPLE_FAILED', loadId: loading.pendingLoad ?? -1 });
    expect(failed.screen).toBe('CTM100');
    expect(failed.status).toBe(MESSAGES.LOAD_FAILED);
    expect(renderGrid(failed).join('\n')).not.toContain(SENTINEL);
  });
});
