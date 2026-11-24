// Browser versions of the effect-host dependencies (terminal-ui design, section I). Each one
// receives only the text that the model hands out (the public proof bundle, a file name or a verify
// link) and sends nothing over the network.

/** Writes `text` to the clipboard. Rejects when the clipboard is missing or refuses. */
export async function writeClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Saves `text` as a JSON file through a temporary object URL and a temporary `<a download>`. */
export function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Opens the verify link in a new tab without a window handle back to this page. */
export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener');
}

/** A plain same-origin page navigation (PF3 on CTM900). */
export function navigate(href: string): void {
  location.assign(href);
}
