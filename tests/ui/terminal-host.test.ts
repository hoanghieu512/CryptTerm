import { describe, expect, it } from 'vitest';
import { SENTINEL } from '../support/ledger-arbitraries';
import { SAMPLES } from '../../src/ui/model/samples';
import { MESSAGES } from '../../src/ui/model/messages';
import { until } from '../support/fake-prove';
import { rowsOf } from '../support/prove-state';
import { ENTER, committedSample, fakeFetch, pf } from '../support/terminal-arbitraries';
import { makeHarness } from '../support/terminal-host';
import type { Harness } from '../support/terminal-host';
import type { TerminalState } from '../../src/ui/model/types';

// The host runs the effects of CTM100: it loads the files, runs `checkSignature`, and dispatches
// `SAMPLE_LOADED` (with `signatureValid`) or `SAMPLE_FAILED`. Real signed samples, fake fetch.

/** CTM000, Enter, the sample number typed into the select field, Enter. */
function chooseSample(h: Harness, no: string): void {
  h.terminal.dispatch(ENTER);
  for (const ch of no) h.terminal.dispatch({ type: 'CHAR', ch });
  h.terminal.dispatch(ENTER);
}

const onCtm200 = (h: Harness) => (): boolean => h.terminal.getState().screen === 'CTM200';

/** The committed digest with its first signature character changed. */
function flippedDigestText(name: string): string {
  const digest = committedSample(name).digest;
  const first = digest.signature.startsWith('0') ? '1' : '0';
  return JSON.stringify({ ...digest, signature: `${first}${digest.signature.slice(1)}` });
}

describe('sample_load_through_host', () => {
  it.each(SAMPLES.map((s) => [s.no, s.name] as const))(
    'sample_load_through_host: sample %s (%s) loads, its signature is checked by the host and is valid',
    async (no, name) => {
      const h = makeHarness();
      chooseSample(h, no);
      expect(h.terminal.getState().status).toBe(MESSAGES.LOADING);
      await until(onCtm200(h));
      const state = h.terminal.getState();
      const committed = committedSample(name);
      expect(state.status).toBe(MESSAGES.SAMPLE_LOADED);
      expect(state.sample?.name).toBe(name);
      expect(state.sample?.signatureValid).toBe(true);
      expect(state.sample?.batch).toStrictEqual(committed.batch);
      expect(state.sample?.digest).toStrictEqual(committed.digest);
      expect(h.fetcher.urls.sort()).toEqual([`/samples/${name}.dat`, `/samples/${name}.digest.json`]);
      expect(rowsOf(state).join('\n')).toContain('SIGNATURE VALID (ORIGINAL BATCH)');
    },
  );

  it('sample_load_through_host: a flipped signature byte loads with signatureValid false', async () => {
    const h = makeHarness({ fetcher: fakeFetch({ '/samples/clean.digest.json': flippedDigestText('clean') }) });
    chooseSample(h, '1');
    await until(onCtm200(h));
    expect(h.terminal.getState().sample?.signatureValid).toBe(false);
    expect(rowsOf(h.terminal.getState()).join('\n')).toContain('SIGNATURE INVALID (ORIGINAL BATCH)');
  });

  it('sample_load_through_host: the host uses its trusted key table, so an empty table gives signatureValid false', async () => {
    const h = makeHarness({ deps: { trustedKeys: {} } });
    chooseSample(h, '1');
    await until(onCtm200(h));
    expect(h.terminal.getState().sample?.signatureValid).toBe(false);
  });

  it('sample_load_through_host: a failed load gives SAMPLE LOAD FAILED with no response text', async () => {
    const h = makeHarness({ fetcher: fakeFetch({ '/samples/clean.dat': { notOk: true } }) });
    chooseSample(h, '1');
    await until(() => h.terminal.getState().status === MESSAGES.LOAD_FAILED);
    const state = h.terminal.getState();
    expect(state.screen).toBe('CTM100');
    expect(state.sample).toBeNull();
    expect(rowsOf(state).join('\n')).not.toContain(SENTINEL);
  });

  it('sample_load_through_host: a result that arrives after PF3 is dropped', async () => {
    const h = makeHarness();
    chooseSample(h, '1');
    h.terminal.dispatch(pf(3));
    const left: TerminalState = h.terminal.getState();
    expect(left.screen).toBe('CTM000');
    // The load finishes in the background. Wait until the fetches were made, then a few more turns.
    await until(() => h.fetcher.urls.length === 2);
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
    expect(h.terminal.getState()).toBe(left);
  });

  it('sample_load_through_host: a bad sample number never reaches the host', () => {
    const h = makeHarness();
    h.terminal.dispatch(ENTER);
    h.terminal.dispatch({ type: 'CHAR', ch: '9' });
    h.terminal.dispatch(ENTER);
    expect(h.terminal.getState().status).toBe(MESSAGES.SELECT_INVALID);
    expect(h.fetcher.urls).toEqual([]);
    expect(h.terminal.getState().screen).toBe('CTM100');
  });
});
