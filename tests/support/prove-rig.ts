// A Prove_Service wired to in-process ports and a stub backend, with what the tests need to
// inspect: every port that was opened, the stub counters, and the progress calls.
import { createProveService } from '../../src/zk/prove-service';
import type { WorkerPort } from '../../src/zk/worker-port';
import { createInProcessPort, createStubBackend } from './in-process-port';
import type { InProcessPort, StubControl, StubOptions } from './in-process-port';

export interface ProveRig {
  readonly service: ReturnType<typeof createProveService>;
  readonly ports: InProcessPort[];
  readonly control: StubControl;
  // The stages passed to onProgress, in order.
  readonly stages: string[];
  readonly onProgress: (stage: string) => void;
}

export function createRig(options: StubOptions = {}): ProveRig {
  const { backend, control } = createStubBackend(options);
  const ports: InProcessPort[] = [];
  const openPort = (): WorkerPort => {
    const port = createInProcessPort(backend);
    ports.push(port);
    return port;
  };
  const stages: string[] = [];
  const onProgress = (stage: string): void => {
    stages.push(stage);
  };
  return { service: createProveService(openPort), ports, control, stages, onProgress };
}

// The error a promise rejects with, or undefined when it resolves.
export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

// Lets queued microtasks and timers run, so pending messages are delivered.
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}
