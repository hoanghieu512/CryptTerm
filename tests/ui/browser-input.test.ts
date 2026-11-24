import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBundleInput } from '../../src/ui/browser-input';
import type { Action, DroppedFile } from '../../src/ui/model/types';
import { makeHarness } from '../support/terminal-host';
import type { Harness } from '../support/terminal-host';
import { TINY_BATCH, stateOn } from '../support/terminal-arbitraries';

// Group 3 test `verify_paste_and_drop` (verifier Requirements 3.3, 3.4, 6.3): the DOM glue of the
// bundle input, driven with fake events and a fake event target. No browser, no real DOM. The
// terminal behind the listeners is the real host from `makeHarness`, so a dispatched action runs the
// real model. Every event is synthetic and holds no real data.

const SENTINEL_TEXT = 'PASTE-S3NT1N3L-5521';

interface FakeEvent {
  defaultPrevented: boolean;
  preventDefault(): void;
  clipboardData?: { getData(type: string): string };
  dataTransfer?: { files: readonly DroppedFile[] };
}

type Listener = (event: FakeEvent) => void;

/** The part of `Document` that the glue may use. It records every add and remove. */
interface FakeTarget {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  readonly added: string[];
  readonly removed: string[];
  fire(type: string, event: FakeEvent): void;
  count(type: string): number;
}

function fakeTarget(): FakeTarget {
  const listeners = new Map<string, Set<Listener>>();
  const added: string[] = [];
  const removed: string[] = [];
  return {
    addEventListener(type, listener) {
      added.push(type);
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      removed.push(type);
      listeners.get(type)?.delete(listener);
    },
    added,
    removed,
    fire(type, event) {
      for (const listener of Array.from(listeners.get(type) ?? [])) listener(event);
    },
    count(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function pasteEvent(text: string): FakeEvent {
  const event: FakeEvent = {
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    clipboardData: { getData: (type) => (type === 'text/plain' ? text : '') },
  };
  return event;
}

function dragEvent(files: readonly DroppedFile[] = []): FakeEvent {
  const event: FakeEvent = {
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    dataTransfer: { files },
  };
  return event;
}

function jsonFile(name: string, text: string): DroppedFile {
  return { name, size: text.length, text: async () => text };
}

/** Wraps the harness terminal so that the test sees every action the glue dispatches. */
function recording(harness: Harness): { terminal: Pick<Harness['terminal'], 'getState' | 'dispatch'>; actions: Action[] } {
  const actions: Action[] = [];
  return {
    actions,
    terminal: {
      getState: () => harness.terminal.getState(),
      dispatch: (action) => {
        actions.push(action);
        harness.terminal.dispatch(action);
      },
    },
  };
}

function setup(screen: 'CTM900' | 'CTM300') {
  const harness = makeHarness({ initial: stateOn(screen, TINY_BATCH) });
  const target = fakeTarget();
  const { terminal, actions } = recording(harness);
  const remove = installBundleInput(target, terminal);
  return { harness, target, actions, remove };
}

/** Lets the file read of a drop settle: `File.text()` resolves, then the host dispatches FILE_READ. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verify_paste_and_drop: fake events', () => {
  it('verify_paste_and_drop: installs exactly the paste, dragover and drop listeners', () => {
    const { target } = setup('CTM900');
    expect([...target.added].sort()).toEqual(['dragover', 'drop', 'paste']);
  });

  it('verify_paste_and_drop: on CTM900 a paste is cancelled and replaces the bundle text', () => {
    const { harness, target, actions } = setup('CTM900');
    const event = pasteEvent(SENTINEL_TEXT);
    target.fire('paste', event);
    expect(event.defaultPrevented).toBe(true);
    expect(actions).toEqual([{ type: 'PASTE_TEXT', text: SENTINEL_TEXT }]);
    const { verify } = harness.terminal.getState();
    expect(verify.source).toBe('PASTE');
    expect(verify.bundleText).toBe(SENTINEL_TEXT);
  });

  it('verify_paste_and_drop: on CTM900 a dragover is cancelled so that the drop is allowed', () => {
    const { target, actions } = setup('CTM900');
    const event = dragEvent();
    target.fire('dragover', event);
    expect(event.defaultPrevented).toBe(true);
    expect(actions).toEqual([]);
  });

  it('verify_paste_and_drop: on CTM900 a dropped .json file is cancelled, reaches FILES_DROPPED and is read', async () => {
    const { harness, target, actions } = setup('CTM900');
    const file = jsonFile('BUNDLE.JSON', SENTINEL_TEXT);
    const event = dragEvent([file]);
    target.fire('drop', event);
    expect(event.defaultPrevented).toBe(true);
    expect(actions[0]).toEqual({ type: 'FILES_DROPPED', files: [file] });
    await settle();
    const { verify } = harness.terminal.getState();
    expect(verify.source).toBe('FILE');
    expect(verify.bundleText).toBe(SENTINEL_TEXT);
  });

  it('verify_paste_and_drop: off CTM900 no event is cancelled and nothing is dispatched', () => {
    const { harness, target, actions } = setup('CTM300');
    const before = harness.terminal.getState();
    const paste = pasteEvent(SENTINEL_TEXT);
    const over = dragEvent();
    const drop = dragEvent([jsonFile('b.json', SENTINEL_TEXT)]);
    target.fire('paste', paste);
    target.fire('dragover', over);
    target.fire('drop', drop);
    expect([paste.defaultPrevented, over.defaultPrevented, drop.defaultPrevented]).toEqual([false, false, false]);
    expect(actions).toEqual([]);
    expect(harness.terminal.getState()).toBe(before);
  });

  it('verify_paste_and_drop: the returned function removes the three listeners', () => {
    const { target, actions, remove } = setup('CTM900');
    remove();
    expect([...target.removed].sort()).toEqual(['dragover', 'drop', 'paste']);
    expect(target.count('paste') + target.count('dragover') + target.count('drop')).toBe(0);
    const paste = pasteEvent(SENTINEL_TEXT);
    target.fire('paste', paste);
    expect(paste.defaultPrevented).toBe(false);
    expect(actions).toEqual([]);
  });

  it('verify_paste_and_drop: no handler touches location, history or storage', async () => {
    const touched: string[] = [];
    const trap = (name: string): object =>
      new Proxy(
        {},
        {
          get: (_t, prop) => {
            touched.push(`${name}.${String(prop)}`);
            return undefined;
          },
          set: (_t, prop) => {
            touched.push(`${name}.${String(prop)}=`);
            return true;
          },
        },
      );
    // Built before the stubs, so the setup is not counted as an access.
    const { target, remove } = setup('CTM900');
    for (const name of ['location', 'history', 'localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      vi.stubGlobal(name, trap(name));
    }
    target.fire('paste', pasteEvent(SENTINEL_TEXT));
    target.fire('dragover', dragEvent());
    target.fire('drop', dragEvent([jsonFile('b.json', SENTINEL_TEXT)]));
    await settle();
    remove();
    expect(touched).toEqual([]);
  });
});
