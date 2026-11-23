import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ProveError } from '../../src/zk/prove-service';
import { exampleBundle, tick } from '../support/fake-prove';
import { runProperty } from '../support/pbt';
import { ctm300 } from '../support/prove-state';
import { ENTER, pf } from '../support/terminal-arbitraries';
import { createRig, flush } from '../support/prove-rig';
import { makeHarness } from '../support/terminal-host';

type Op = 'oldResolve' | 'oldReject' | 'oldProgress' | 'enter' | 'press' | 'leave';
const OPS: readonly Op[] = ['oldResolve', 'oldReject', 'oldProgress', 'enter', 'press', 'leave'];
const opsArb = fc.array(fc.tuple(fc.constantFrom(...OPS), fc.nat()), { minLength: 1, maxLength: 20 });

describe('leave_mid_proof', () => {
  // Feature: terminal-ui, Property 21: A run that was left never changes the screen
  it('leave_mid_proof: any order of leave, old settle, re-entry and new run changes nothing from an old run (P21)', async () => {
    await runProperty('terminal-ui P21 leave_mid_proof', { seed: 20264021, numRuns: 200 }, fc.asyncProperty(opsArb, async (ops) => {
      const h = makeHarness({ initial: ctm300() });
      h.terminal.dispatch(pf(5));
      let screen: 'CTM200' | 'CTM300' = 'CTM300';
      let active: number | null = 0;
      const cancelled: number[] = [];
      let expectedCancels = 0;

      for (const [op, pick] of ops) {
        if (op === 'press') {
          const calls = h.fake.calls.length;
          h.terminal.dispatch(pf(5));
          const starts = screen === 'CTM300' && active === null;
          expect(h.fake.calls).toHaveLength(starts ? calls + 1 : calls);
          if (starts) active = h.fake.calls.length - 1;
        } else if (op === 'leave') {
          if (screen !== 'CTM300') continue;
          h.terminal.dispatch(pf(3));
          screen = 'CTM200';
          if (active !== null) {
            cancelled.push(active);
            active = null;
            expectedCancels += 1;
          }
        } else if (op === 'enter') {
          if (screen !== 'CTM200') continue;
          h.terminal.dispatch(ENTER);
          screen = 'CTM300';
        } else {
          const index = cancelled.length === 0 ? undefined : cancelled[pick % cancelled.length];
          if (index === undefined) continue;
          const before = h.terminal.getState();
          if (op === 'oldResolve') h.fake.resolve(exampleBundle(), index);
          else if (op === 'oldReject') h.fake.reject(new ProveError('CANCELLED'), index);
          else h.fake.progress('PROVE', index);
          await tick();
          expect(Object.is(h.terminal.getState(), before)).toBe(true);
        }
        expect(h.terminal.getState().screen).toBe(screen);
        expect(h.fake.cancelCount()).toBe(expectedCancels);
      }
    }));
  });

  it('leave_mid_proof: a resolve that arrives after PF3 is dropped and the screen stays CTM200', async () => {
    const h = makeHarness({ initial: ctm300() });
    h.terminal.dispatch(pf(5));
    h.terminal.dispatch(pf(3));
    const left = h.terminal.getState();
    expect(left.screen).toBe('CTM200');
    expect(left.prove).toEqual({ kind: 'idle' });
    expect(h.fake.cancelCount()).toBe(1);
    h.fake.resolve(exampleBundle());
    await tick();
    expect(h.terminal.getState()).toBe(left);
  });

  // Design risk 10: the real service clears its active run at once and rejects CANCELLED later.
  it('leave_mid_proof: real service over a stub backend, the clear is synchronous and CANCELLED arrives later and is dropped', async () => {
    const rig = createRig({ hold: true });
    const h = makeHarness({ initial: ctm300(), deps: { prove: rig.service } });
    h.terminal.dispatch(pf(5));
    await flush();
    expect(h.terminal.getState().prove.kind).toBe('proving');
    expect(rig.ports).toHaveLength(1);
    expect(rig.control.counts.prove).toBe(1);

    // No await between the key and these checks: the state is cleared synchronously.
    h.terminal.dispatch(pf(3));
    const left = h.terminal.getState();
    expect(left.screen).toBe('CTM200');
    expect(left.prove).toEqual({ kind: 'idle' });
    expect(rig.ports[0]?.terminated).toBe(true);

    // The CANCELLED rejection of the old run arrives on a later turn and changes nothing.
    await flush();
    expect(h.terminal.getState()).toBe(left);

    // The service is free again at once: the next run is not refused as BUSY.
    h.terminal.dispatch(ENTER);
    h.terminal.dispatch(pf(5));
    const second = h.terminal.getState();
    expect(second.screen).toBe('CTM300');
    expect(second.prove.kind).toBe('proving');
    await flush();
    expect(rig.ports).toHaveLength(2);

    // The old run's late work cannot touch the new run. The new run then completes.
    rig.control.release();
    await flush();
    const done = h.terminal.getState();
    expect(done.prove.kind).toBe('done');
    expect(done.status).toBe('PROOF GENERATED');
  });
});
