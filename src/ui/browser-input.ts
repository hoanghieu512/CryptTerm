// The DOM glue of the CTM900 bundle input (verifier design, "Browser input"). It turns `paste`,
// `dragover` and `drop` events into PASTE_TEXT and FILES_DROPPED actions. The listeners act only
// while the screen is CTM900, so the other screens keep the default browser behavior. The glue
// reads nothing but the event and the screen id. It never touches the URL, history or storage, and
// it never keeps the text it is handed.
import type { Terminal } from './model/terminal';
import type { DroppedFile } from './model/types';

/** The part of a clipboard or drag event that the glue uses. `Event` satisfies it. */
export interface BundleInputEvent {
  preventDefault(): void;
  readonly clipboardData?: { getData(type: string): string } | null;
  readonly dataTransfer?: { readonly files: ArrayLike<DroppedFile> } | null;
}

/** The part of `Document` that the glue uses. */
export interface BundleInputTarget {
  addEventListener(type: string, listener: (event: BundleInputEvent) => void): void;
  removeEventListener(type: string, listener: (event: BundleInputEvent) => void): void;
}

/** Installs the three listeners and returns the function that removes them. */
export function installBundleInput(
  target: BundleInputTarget,
  terminal: Pick<Terminal, 'getState' | 'dispatch'>,
): () => void {
  const onCtm900 = (): boolean => terminal.getState().screen === 'CTM900';

  const onPaste = (event: BundleInputEvent): void => {
    if (!onCtm900()) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    terminal.dispatch({ type: 'PASTE_TEXT', text });
  };

  // A drop is allowed only when `dragover` was cancelled.
  const onDragOver = (event: BundleInputEvent): void => {
    if (!onCtm900()) return;
    event.preventDefault();
  };

  const onDrop = (event: BundleInputEvent): void => {
    if (!onCtm900()) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    terminal.dispatch({ type: 'FILES_DROPPED', files });
  };

  target.addEventListener('paste', onPaste);
  target.addEventListener('dragover', onDragOver);
  target.addEventListener('drop', onDrop);
  return () => {
    target.removeEventListener('paste', onPaste);
    target.removeEventListener('dragover', onDragOver);
    target.removeEventListener('drop', onDrop);
  };
}
