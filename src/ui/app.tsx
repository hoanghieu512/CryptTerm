// The shell of the block-mode terminal (terminal-ui design, sections A, C and I). It builds the
// effect host once, reads the state with `useSyncExternalStore`, and installs the single document
// `keydown` listener. PF buttons and keys dispatch the same action (`pfAction`).
import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { cancelProve, proveBatch } from '../zk/prove-service';
import { download, openLink, writeClipboard } from './browser-deps';
import { handleKey, pfAction } from './model/keys';
import { createTerminal } from './model/terminal';
import type { PfNumber } from './model/types';
import { createSampleLoader } from './sample-loader';
import { TerminalView } from './terminal-view';

export function App() {
  // One host for the life of the page. The initializer has no effect: nothing runs until a key.
  const [terminal] = useState(() =>
    createTerminal({
      prove: { proveBatch, cancelProve },
      loadSample: createSampleLoader(),
      writeClipboard,
      download,
      openLink,
    }),
  );
  // `subscribe` and `getState` belong to the host, so they are the same functions on every render.
  const state = useSyncExternalStore(terminal.subscribe, terminal.getState);

  // A layout effect runs in the commit, before the first paint, so the logon screen is never
  // visible while the key listener is still missing.
  useLayoutEffect(() => {
    const onKeyDown = (ev: KeyboardEvent): void => {
      const result = handleKey(ev);
      if (result.preventDefault) ev.preventDefault();
      if (result.action !== null) terminal.dispatch(result.action);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [terminal]);

  const onPf = useCallback((pf: PfNumber): void => terminal.dispatch(pfAction(pf)), [terminal]);

  return <TerminalView state={state} onPf={onPf} />;
}
