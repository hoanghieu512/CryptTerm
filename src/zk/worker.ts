// The proof worker entry (zk-core design section C). A module worker: it touches no page globals.
// It hands every message to the worker core and posts back the events that the core produces.
// The Prove_Service and the verify client each start their own instance of this file.
import { createBrowserBackend } from './worker-backend';
import { createWorkerCore } from './worker-core';
import type { WorkerEvent } from './worker-protocol';

// The parts of the worker global scope used here. The repo's `lib` is DOM, whose `Window` type
// already satisfies this interface, so `self` needs no cast.
interface WorkerScope {
  postMessage(message: WorkerEvent): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

const scope: WorkerScope = self;
const core = createWorkerCore(createBrowserBackend(), (event) => scope.postMessage(event));

scope.addEventListener('message', (event) => {
  void core.handle(event.data);
});
