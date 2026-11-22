// The page-side client of the Verify_Worker (zk-core design section C).
//
// The proof check of the verifier runs in a worker of its own, apart from the worker of the
// Prove_Service, so a running proof never blocks or changes it. The client resolves a boolean and
// never rejects: a failure, a worker error and a timeout all mean "not valid". Nothing from the
// worker, and no error text, is passed on.
import type { ProofVerifier } from './verifier';
import type { PortFactory, WorkerPort } from './worker-port';
import { isWorkerEvent } from './worker-protocol';

export const VERIFY_TIMEOUT_MS = 60_000;

export function createProofVerifier(openPort: PortFactory, timeoutMs: number = VERIFY_TIMEOUT_MS): ProofVerifier {
  let nextRunId = 1;
  let port: WorkerPort | undefined;
  // Each pending call, by run id. Calling its resolver also clears its timer.
  const pending = new Map<number, (valid: boolean) => void>();

  function failAll(): void {
    for (const resolve of [...pending.values()]) resolve(false);
  }

  function dropPort(): void {
    port?.terminate();
    port = undefined;
  }

  // Only a well-formed event from the current port that names a pending run has any effect.
  function onMessage(from: WorkerPort, message: unknown): void {
    if (from !== port || !isWorkerEvent(message)) return;
    const resolve = pending.get(message.runId);
    if (resolve === undefined) return;
    if (message.type === 'verified') resolve(message.valid);
    else if (message.type === 'failed') resolve(false);
  }

  function currentPort(): WorkerPort {
    if (port !== undefined) return port;
    const opened = openPort();
    opened.onMessage((message) => onMessage(opened, message));
    opened.onError(() => {
      if (opened !== port) return;
      dropPort();
      failAll();
    });
    port = opened;
    return opened;
  }

  return (proof, publicInputs) =>
    new Promise<boolean>((resolve) => {
      const runId = nextRunId;
      nextRunId += 1;
      const timer = setTimeout(() => {
        dropPort();
        failAll();
      }, timeoutMs);
      pending.set(runId, (valid) => {
        clearTimeout(timer);
        pending.delete(runId);
        resolve(valid);
      });
      try {
        currentPort().post({ type: 'verify', runId, proof, publicInputs });
      } catch {
        dropPort();
        failAll();
      }
    });
}
