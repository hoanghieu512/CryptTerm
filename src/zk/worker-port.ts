// The channel between a page-side service and one worker (zk-core design section C).
//
// The services take a PortFactory, so Node tests use an in-process port and only
// `openBrowserPort` touches `Worker`. A port passes no error payload on: a worker error is a bare
// signal, so no message text can travel from the worker to the page.
import type { WorkerRequest } from './worker-protocol';

export interface WorkerPort {
  post(message: WorkerRequest): void;
  onMessage(handler: (message: unknown) => void): void;
  // Fires on a worker `error` or `messageerror`. Nothing about the error is passed on.
  onError(handler: () => void): void;
  terminate(): void;
}

export type PortFactory = () => WorkerPort;

// A new module worker from `worker.ts`. Vite needs the literal `new Worker(new URL(...))` form.
export function openBrowserPort(): WorkerPort {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const onEvent = (name: 'message' | 'error' | 'messageerror', run: (event: Event) => void): void =>
    worker.addEventListener(name, run);
  return {
    post: (message) => worker.postMessage(message),
    onMessage: (handler) => onEvent('message', (event) => handler((event as MessageEvent<unknown>).data)),
    onError: (handler) => {
      onEvent('error', () => handler());
      onEvent('messageerror', () => handler());
    },
    terminate: () => worker.terminate(),
  };
}
