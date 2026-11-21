// Spike page script: a thin adapter between the DOM, the worker and the pure view model.
//
// The page feeds events to `reduce` and writes `render(state)` into the DOM with `textContent`
// only. It owns the single page clock: `t0` is read on the page, immediately before the worker is
// created, and `TOTAL` is computed on the page when the `done` message arrives (Requirement 8.6).
// All `noir_js` and `bb.js` work runs inside the worker (Requirement 8.1); this file imports no
// prover code and never imports the worker module (only the `new Worker(new URL(...))` form).
//
// Privacy (Requirement 10): no console output, no web storage, no browser database, no cookies,
// no network call of its own, no HTML string parsing, no global error handler. Worker errors reach
// the page only as the `error` and `messageerror` events and are shown as a stage failure.
// The only imports are `spike-view.ts` and `spike-protocol.ts`.
import { isWorkerToPage } from './spike-protocol';
import type { PageToWorker } from './spike-protocol';
import { controlsDisabled, INITIAL_STATE, reduce, render } from './spike-view';
import type { Row, ViewEvent, ViewState } from './spike-view';

/** The invalid-witness run gets 120 s, then the page terminates the worker (Requirement 9.8). */
const INVALID_RUN_TIMEOUT_MS = 120_000;

function element<T extends HTMLElement>(id: string, kind: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`MISSING ELEMENT ${id}`);
  return found;
}

const titleEl = element('title', HTMLElement);
const demoLabelEl = element('demo-label', HTMLElement);
const runButton = element('run', HTMLButtonElement);
const invalidButton = element('invalid-witness', HTMLButtonElement);
const statusEl = element('status', HTMLElement);
const detailEl = element('detail', HTMLElement);
const timingsTable = element('timings', HTMLTableElement);
const timingsBody = element('timings-body', HTMLTableSectionElement);
const rawErrorBlock = element('raw-error-block', HTMLElement);
const rawErrorLabelEl = element('raw-error-label', HTMLElement);
const rawErrorPre = element('raw-error', HTMLElement);
const rawProofBlock = element('raw-proof-error-block', HTMLElement);
const rawProofLabelEl = element('raw-proof-error-label', HTMLElement);
const rawProofPre = element('raw-proof-error', HTMLElement);

let state: ViewState = INITIAL_STATE;
/** The live worker, or null. A later run always creates a fresh one. */
let worker: Worker | null = null;
let invalidTimer: ReturnType<typeof setTimeout> | null = null;
/** Page clock reading taken immediately before the current worker was created. */
let t0 = 0;

function rowElement(row: Row): HTMLTableRowElement {
  const tr = document.createElement('tr');
  if (row.secondary) tr.classList.add('secondary');
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = row.label;
  const value = document.createElement('td');
  value.textContent = row.value;
  if (row.quoted) value.classList.add('quoted');
  tr.append(label, value);
  return tr;
}

function setRaw(
  block: HTMLElement,
  labelEl: HTMLElement,
  pre: HTMLElement,
  label: string,
  message: string | null,
): void {
  block.hidden = message === null;
  labelEl.textContent = message === null ? '' : label;
  pre.textContent = message ?? '';
}

/** Writes the view model into the DOM. Text only, through `textContent`. */
function draw(): void {
  const vm = render(state);
  titleEl.textContent = vm.title;
  demoLabelEl.textContent = vm.demoLabel;
  runButton.textContent = vm.runLabel;
  invalidButton.textContent = vm.invalidWitnessLabel;
  runButton.disabled = vm.controlsDisabled;
  invalidButton.disabled = vm.controlsDisabled;
  statusEl.textContent = vm.statusLine;
  detailEl.hidden = vm.detailLine === null;
  detailEl.textContent = vm.detailLine ?? '';
  timingsTable.hidden = vm.rows.length === 0;
  timingsBody.replaceChildren(...vm.rows.map(rowElement));
  setRaw(rawErrorBlock, rawErrorLabelEl, rawErrorPre, vm.rawErrorLabel, vm.rawErrorMessage);
  setRaw(rawProofBlock, rawProofLabelEl, rawProofPre, vm.rawProofErrorLabel, vm.rawProofErrorMessage);
}

/** Terminates the worker and drops the reference and the timer. Safe to call when none exist. */
function release(): void {
  if (invalidTimer !== null) {
    clearTimeout(invalidTimer);
    invalidTimer = null;
  }
  if (worker !== null) {
    worker.terminate();
    worker = null;
  }
}

/**
 * Feeds one event to the reducer and redraws synchronously, so the status line follows each
 * `stage-start` message within the same task (Requirement 8.10). When the run is no longer
 * running (succeeded, failed or timed out) the worker is terminated.
 */
function dispatch(event: ViewEvent): void {
  state = reduce(state, event);
  draw();
  if (state.kind !== 'running') release();
}

function start(mode: 'valid' | 'invalid'): void {
  if (controlsDisabled(state) || worker !== null) return; // a second press creates no second worker
  // State goes to `running` and both controls are disabled before the worker exists.
  dispatch({ type: mode === 'valid' ? 'run' : 'run-invalid' });

  let created: Worker;
  try {
    t0 = performance.now();
    created = new Worker(new URL('./spike-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    dispatch({ type: 'worker-error' });
    return;
  }
  worker = created;

  created.addEventListener('message', (event: MessageEvent<unknown>) => {
    // The page clock is read first, before any other work on this message.
    const totalMs = Math.ceil(performance.now() - t0);
    if (created !== worker) return; // a message from a worker that was already released
    const message: unknown = event.data;
    if (!isWorkerToPage(message)) {
      dispatch({ type: 'worker-error' });
      return;
    }
    dispatch({
      type: 'worker-message',
      message,
      context: { totalMs, pageIsolated: window.crossOriginIsolated },
    });
  });
  created.addEventListener('error', () => {
    if (created === worker) dispatch({ type: 'worker-error' });
  });
  created.addEventListener('messageerror', () => {
    if (created === worker) dispatch({ type: 'worker-error' });
  });

  if (mode === 'invalid') {
    invalidTimer = setTimeout(() => {
      invalidTimer = null;
      if (created === worker) dispatch({ type: 'timeout' });
    }, INVALID_RUN_TIMEOUT_MS);
  }
  const command: PageToWorker = mode === 'valid' ? { type: 'run' } : { type: 'run-invalid' };
  created.postMessage(command);
}

runButton.addEventListener('click', () => {
  start('valid');
});
invalidButton.addEventListener('click', () => {
  start('invalid');
});

draw();
