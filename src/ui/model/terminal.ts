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
import { TRUSTED_SOURCE_KEYS } from '../../ledger/trusted-keys';
import type { Cents } from '../../ledger/posting';
import { checkSignature } from './digest-status';
import type { SampleName } from './samples';
import { sourceKeyIdOf } from './source-key-id';
import { initialState, update } from './update';
import type { Action, Effect, LoadedSample, TerminalState } from './types';

export interface TerminalDeps {
  /** Prove_Port (`src/zk/prove-service.ts`). */
  readonly prove: ProveService;
  readonly loadSample: (name: SampleName) => Promise<{ batch: Batch; digest: SignedDigest }>;
  readonly writeClipboard: (text: string) => Promise<void>;
  readonly download: (filename: string, text: string) => void;
  readonly openLink: (href: string) => void;
  /**
   * The verifier (`verifyBundle` in `src/zk/verifier.ts`). The result type is `unknown` on purpose:
   * the model accepts only a well-formed report (`normalizeReport`), so a test can inject a fake
   * that resolves with `null` or a malformed value.
   */
  readonly verify: (text: string, policy: { readonly limitCents: Cents }) => Promise<unknown>;
  /** A plain page navigation (PF3 on CTM900). */
  readonly navigate: (href: string) => void;
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

/**
 * True when the report holds a step named SIGNATURE with `ok === true`. A guarded read: any throw
 * is false. It only decides whether to look up the key id. Display is decided by `normalizeReport`.
 */
function signatureOk(report: unknown): boolean {
  try {
    const steps: unknown = (report as { readonly steps?: unknown } | null)?.steps;
    if (!Array.isArray(steps)) return false;
    return steps.some((s: unknown) => {
      const step = s as { readonly name?: unknown; readonly ok?: unknown } | null;
      return step?.name === 'SIGNATURE' && step.ok === true;
    });
  } catch {
    return false;
  }
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

  // The fail-closed mapping to REJECTED: VERIFIER ERROR starts here and ends in verify-flow.ts. A
  // rejection or a throw becomes VERIFY_FAILED, and the rejection value is never bound. A value
  // that resolves goes to VERIFY_DONE as it is, and `normalizeReport` turns anything that is not a
  // well-formed report into the same error outcome.
  function runVerify(effect: Extract<Effect, { type: 'VERIFY' }>): void {
    const { runId, text, limitCents } = effect;
    start(() => deps.verify(text, { limitCents }))
      .then(
        (report: unknown) => {
          const keys = deps.trustedKeys ?? TRUSTED_SOURCE_KEYS;
          const keyId = signatureOk(report) ? sourceKeyIdOf(text, keys) : null;
          dispatch({ type: 'VERIFY_DONE', runId, report, keyId });
        },
        () => dispatch({ type: 'VERIFY_FAILED', runId }),
      )
      .then(undefined, ignore);
  }
  function runReadFile(effect: Extract<Effect, { type: 'READ_FILE' }>): void {
    const { readId, file } = effect;
    start(() => file.text())
      .then(
        (text) => dispatch({ type: 'FILE_READ', readId, text }),
        () => dispatch({ type: 'FILE_READ_FAILED', readId }),
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
      case 'VERIFY':
        runVerify(effect);
        return;
      case 'READ_FILE':
        runReadFile(effect);
        return;
      case 'NAVIGATE':
        try {
          deps.navigate(effect.href);
        } catch {
          // No status change is defined for a failed navigation.
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
