// The effect host (terminal-ui design, section A, "The effect host and the injected Prove_Port").
//
// `dispatch` computes `update`, stores the new state, notifies subscribers, and only then runs the
// effects. The state is therefore stored before any effect runs, so an effect that calls back
// synchronously is safe (the real service calls `onProgress('PRECHECK')` inside `proveBatch`).
//
// Every action that an effect feeds back carries the id of the load or run that started it, and
// `update` drops it when that id is no longer current. No rejection value is ever bound or kept:
// a failure becomes a fixed `ProveReason`, `UNEXPECTED` or `ok: false`, so nothing but fixed text
// can reach the screen. No promise is left without a rejection handler.
import type { Batch } from '../../ledger/batch';
import type { SignedDigest } from '../../ledger/digest';
import type { ProofBundle } from '../../zk/bundle';
import { PROVE_ERROR_MESSAGES, ProveError } from '../../zk/prove-service';
import type { ProveReason, ProveService } from '../../zk/prove-service';
import { checkSignature } from './digest-status';
import type { SampleName } from './samples';
import { initialState, update } from './update';
import type { Action, Effect, LoadedSample, TerminalState } from './types';

export interface TerminalDeps {
  /** Prove_Port (`src/zk/prove-service.ts`). */
  readonly prove: ProveService;
  readonly loadSample: (name: SampleName) => Promise<{ batch: Batch; digest: SignedDigest }>;
  readonly writeClipboard: (text: string) => Promise<void>;
  readonly download: (filename: string, text: string) => void;
  readonly openLink: (href: string) => void;
  /** Defaults to the trusted source keys of `checkSignature`. */
  readonly trustedKeys?: Readonly<Record<string, string>>;
}

export interface Terminal {
  getState(): TerminalState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
}

/** Starts `fn` now. A synchronous throw becomes a rejection, so one handler covers both. */
function start<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(fn());
  });
}

/** A rejection becomes a known reason only for a `ProveError` with an own, listed reason. */
function reasonOf(err: unknown): ProveReason | 'UNEXPECTED' {
  return err instanceof ProveError && Object.hasOwn(PROVE_ERROR_MESSAGES, err.reason) ? err.reason : 'UNEXPECTED';
}

export function createTerminal(deps: TerminalDeps, initial: TerminalState = initialState()): Terminal {
  let current: TerminalState = initial;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A failing listener must not stop the other listeners or the effects.
      }
    }
  };

  const dispatch = (action: Action): void => {
    const result = update(current, action);
    const changed = !Object.is(result.state, current);
    current = result.state;
    if (changed) notify();
    for (const effect of result.effects) run(effect);
  };

  // The `.then(undefined, () => undefined)` at the end of each chain keeps a throw inside
  // `dispatch` from becoming an unhandled rejection.
  const ignore = (): void => undefined;

  function runLoad(loadId: number, name: SampleName): void {
    start(async () => {
      const { batch, digest } = await deps.loadSample(name);
      const signatureValid = await checkSignature(digest, deps.trustedKeys);
      const sample: LoadedSample = { name, batch, digest, signatureValid };
      return sample;
    })
      .then(
        (sample) => dispatch({ type: 'SAMPLE_LOADED', loadId, sample }),
        () => dispatch({ type: 'SAMPLE_FAILED', loadId }),
      )
      .then(undefined, ignore);
  }

  function runProve(effect: Extract<Effect, { type: 'PROVE' }>): void {
    const { runId, batch, digest, limitCents } = effect;
    let running: Promise<ProofBundle>;
    try {
      running = deps.prove.proveBatch(batch, digest, limitCents, (stage) =>
        dispatch({ type: 'PROVE_PROGRESS', runId, stage }),
      );
    } catch {
      // A synchronous throw is UNEXPECTED at once, so PF5 works again in the same turn.
      dispatch({ type: 'PROVE_FAILED', runId, reason: 'UNEXPECTED' });
      return;
    }
    running
      .then(
        (bundle) => dispatch({ type: 'PROVE_DONE', runId, bundle }),
        (err: unknown) => dispatch({ type: 'PROVE_FAILED', runId, reason: reasonOf(err) }),
      )
      .then(undefined, ignore);
  }

  function runClipboard(text: string): void {
    start(() => deps.writeClipboard(text))
      .then(
        () => dispatch({ type: 'CLIPBOARD_DONE', ok: true }),
        () => dispatch({ type: 'CLIPBOARD_DONE', ok: false }),
      )
      .then(undefined, ignore);
  }

  function run(effect: Effect): void {
    switch (effect.type) {
      case 'LOAD_SAMPLE':
        runLoad(effect.loadId, effect.name);
        return;
      case 'PROVE':
        runProve(effect);
        return;
      case 'CANCEL_PROVE':
        // No action re-enters: the rejection that follows carries an old run id and is dropped.
        try {
          deps.prove.cancelProve();
        } catch {
          // Cancel is best effort. The run is already cleared from the state.
        }
        return;
      case 'CLIPBOARD_WRITE':
        runClipboard(effect.text);
        return;
      case 'DOWNLOAD':
        try {
          deps.download(effect.filename, effect.text);
        } catch {
          // No status change is defined for a failed download.
        }
        return;
      case 'OPEN_LINK':
        try {
          deps.openLink(effect.href);
        } catch {
          // No status change is defined for a failed open.
        }
        return;
    }
  }

  return {
    getState: () => current,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
