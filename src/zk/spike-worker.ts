// Spike_Worker: all `noir_js` and `bb.js` work runs here, never on the page's main thread
// (Requirements 8.1, 8.2). A MODULE worker: it touches no page globals.
//
// The page posts one command, `run` or `run-invalid`, to a fresh worker. The worker handles the
// first command and ignores every later message.
//
// `run`: five stages, strictly in sequence in one async function, each awaited:
//   WASM INIT -> WITNESS PREP -> EXECUTE -> PROVE (`threads: 1`) -> VERIFY.
// Each stage posts `stage-start`, runs, then posts `stage-end` with floored milliseconds. WASM INIT
// also posts `init-detail` rows for its parts; those are not part of the stage sum.
// `run-invalid`: the invalid-witness experiment (Requirement 9), see `runInvalid`.
//
// Privacy (Requirement 10): no console output, no web storage, no browser database, no cookies, no Cache API,
// no direct network call in this file. The only network requests are the same-origin GETs of the imported
// helpers (`loadArtifactFromUrl`, `fetchSrsSource`) and the `init` fetch of the two noir WASM files
// by their bundler URLs. bb.js reads its WASM from a `data:` URL inside its own chunk. Failures
// travel as a stage name and a `FailReason` code (`spike-classify.ts`); a raw error message goes
// only into `invalid-report`.
import { BackendType, Barretenberg } from '@aztec-foundation/bb.js';
import initAcvm from '@noir-lang/acvm_js';
import acvmWasmUrl from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url&no-inline';
import { Noir } from '@noir-lang/noir_js';
import initAbi from '@noir-lang/noirc_abi';
import abiWasmUrl from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url&no-inline';
import { ARTIFACT_URL, loadArtifactFromUrl } from './artifact';
import { createHasher } from './hash';
import { acirBytes, executeCircuit, proveCircuit, verifyProofWithVk } from './prover';
import { classifyFailure, elapsedMs, failedMessage, ProofRejectedError } from './spike-classify';
import type { InitPart } from './spike-classify';
import { isPageToWorker } from './spike-protocol';
import type { InitDetailLabel, InvalidReport, Stage, WorkerToPage } from './spike-protocol';
import { collectTexts, describeError, findLeakedFields, modifyFirstSlotByOneCent } from './spike-report';
import { SPIKE_WITNESS } from './spike-witness';
import { SRS_MANIFEST, SRS_URLS } from './srs-assets';
import { fetchSrsSource, initSrs, loadSrs } from './srs';
import type { SrsBytes } from './srs';
import { buildCircuitInputs } from './witness-builder';
import type { BuiltInputs, WitnessInput } from './witness-builder';

/**
 * The parts of the worker global scope this file uses. The repo's `lib` is `DOM` without
 * `WebWorker`, so `self` is typed as `Window & typeof globalThis`, which already satisfies this
 * interface structurally. `const scope: WorkerScope = self` therefore needs no cast, no extra
 * `lib` and no `declare`. At run time `self` is the `DedicatedWorkerGlobalScope`.
 */
interface WorkerScope {
  postMessage(message: WorkerToPage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  readonly crossOriginIsolated: boolean;
}

const scope: WorkerScope = self;

function post(message: WorkerToPage): void {
  scope.postMessage(message);
}

/** Where a throw happened: the stage, and the part while the stage is WASM INIT. */
interface Progress {
  stage: Stage;
  part: InitPart | null;
}

/** Runs one stage: `stage-start`, the work, then `stage-end` with floored milliseconds. */
async function runStage<T>(progress: Progress, stage: Stage, work: () => Promise<T>): Promise<T> {
  progress.stage = stage;
  progress.part = null;
  post({ type: 'stage-start', stage });
  const start = performance.now();
  const result = await work();
  post({ type: 'stage-end', stage, ms: elapsedMs(start, performance.now()) });
  return result;
}

/** Runs one part of WASM INIT and, for the five labelled parts, posts an `init-detail` row. */
async function runPart<T>(progress: Progress, part: InitPart, work: () => Promise<T>): Promise<T> {
  progress.part = part;
  const start = performance.now();
  const result = await work();
  if (part !== 'ACIR') {
    const label: InitDetailLabel = part;
    post({ type: 'init-detail', label, ms: elapsedMs(start, performance.now()) });
  }
  return result;
}

/**
 * Initialises the `acvm_js` and `noirc_abi` WASM from same-origin URLs. Under Vite both packages
 * resolve to their `web` build (`module` field), whose default export is the init function. Both
 * are idempotent, so the `Noir.init()` call inside `execute` returns at once afterwards.
 */
async function initNoirWasm(): Promise<void> {
  await Promise.all([
    initAcvm({ module_or_path: acvmWasmUrl }),
    initAbi({ module_or_path: abiWasmUrl }),
  ]);
}

/**
 * Single-thread WASM on the worker thread, no SRS download (`skipSrsInit: true`, Requirement
 * 14.7). `BackendType.Wasm` runs directly on the calling thread, so there is no nested worker.
 * The SRS is supplied later through `initSrs`, only when a prove needs it.
 */
function newBarretenberg(): Promise<Barretenberg> {
  return Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
}

function loadSrsFromOrigin(): Promise<SrsBytes> {
  return loadSrs(fetchSrsSource(SRS_URLS), SRS_MANIFEST);
}

async function destroyQuietly(api: Barretenberg | null): Promise<void> {
  if (api === null) return;
  try {
    await api.destroy();
  } catch {
    // Nothing to report: the run has already posted its result.
  }
}

function fail(progress: Progress, error: unknown): void {
  post(failedMessage(progress.stage, classifyFailure(error, progress.stage, progress.part), scope.crossOriginIsolated));
}

async function run(): Promise<void> {
  const progress: Progress = { stage: 'WASM INIT', part: null };
  let api: Barretenberg | null = null;
  try {
    const prepared = await runStage(progress, 'WASM INIT', async () => {
      const artifact = await runPart(progress, 'ARTIFACT', () => loadArtifactFromUrl(ARTIFACT_URL));
      await runPart(progress, 'ACVM AND ABI', initNoirWasm);
      api = await runPart(progress, 'BB', newBarretenberg);
      const bb = api;
      const srs = await runPart(progress, 'SRS FETCH', loadSrsFromOrigin);
      await runPart(progress, 'SRS INIT', () => initSrs(bb, srs));
      const acir = await runPart(progress, 'ACIR', () => acirBytes(artifact));
      return { artifact, acir, bb };
    });
    const { artifact, acir, bb } = prepared;
    const built = await runStage(progress, 'WITNESS PREP', () =>
      buildCircuitInputs(createHasher(bb), SPIKE_WITNESS),
    );
    const noir = new Noir(artifact);
    const executed = await runStage(progress, 'EXECUTE', () => executeCircuit(noir, built.inputs));
    const proved = await runStage(progress, 'PROVE', () => proveCircuit(bb, acir, executed.witness));
    await runStage(progress, 'VERIFY', async () => {
      const verified = await verifyProofWithVk(bb, proved.vk, proved.publicInputs, proved.proof);
      if (!verified) throw new ProofRejectedError();
    });
    post({ type: 'done', proofBytes: proved.proofSizeBytes, workerIsolated: scope.crossOriginIsolated });
  } catch (error) {
    fail(progress, error);
  } finally {
    await destroyQuietly(api);
  }
}

/** Proof attempt for the unexpected case that `execute` returned a witness. Every outcome is reported. */
async function attemptProof(
  bb: Barretenberg,
  artifact: Parameters<typeof acirBytes>[0],
  witness: Uint8Array,
): Promise<NonNullable<InvalidReport['proof']>> {
  try {
    await initSrs(bb, await loadSrsFromOrigin());
    const acir = await acirBytes(artifact);
    const proved = await proveCircuit(bb, acir, witness);
    const verified = await verifyProofWithVk(bb, proved.vk, proved.publicInputs, proved.proof);
    return { threw: false, error: null, verified };
  } catch (error) {
    return { threw: true, error: describeError(error), verified: null };
  }
}

/**
 * The invalid-witness experiment (Requirement 9, design "Invalid-witness run"):
 * slot 0 amount plus one cent, leaves and root recomputed, so only the balance constraint can
 * reject. `execute` runs exactly once. The SRS is loaded only if a witness comes back.
 * A failure before `execute` is posted as `failed` with its stage and no report.
 */
async function runInvalid(): Promise<void> {
  const progress: Progress = { stage: 'WASM INIT', part: null };
  let api: Barretenberg | null = null;
  try {
    const prepared = await runStage(progress, 'WASM INIT', async () => {
      const artifact = await runPart(progress, 'ARTIFACT', () => loadArtifactFromUrl(ARTIFACT_URL));
      await runPart(progress, 'ACVM AND ABI', initNoirWasm);
      // Hashing needs no SRS (U19): the instance stays without `srsInitSrs` until a prove needs it.
      api = await runPart(progress, 'BB', newBarretenberg);
      return { artifact, bb: api };
    });
    const { artifact, bb } = prepared;
    const modified: WitnessInput = modifyFirstSlotByOneCent(SPIKE_WITNESS);
    const built: BuiltInputs = await runStage(progress, 'WITNESS PREP', () =>
      buildCircuitInputs(createHasher(bb), modified),
    );
    const noir = new Noir(artifact);
    progress.stage = 'EXECUTE';
    post({ type: 'stage-start', stage: 'EXECUTE' });
    let thrown: unknown;
    let threw = false;
    let witness: Uint8Array | null = null;
    const executeStart = performance.now();
    try {
      witness = (await executeCircuit(noir, built.inputs)).witness;
    } catch (error) {
      threw = true;
      thrown = error;
    }
    post({ type: 'stage-end', stage: 'EXECUTE', ms: elapsedMs(executeStart, performance.now()) });
    const proof = witness === null ? null : await attemptProof(bb, artifact, witness);
    const report: InvalidReport = {
      threw,
      returnedWitness: witness !== null,
      error: threw ? describeError(thrown) : null,
      leaked: threw ? findLeakedFields(collectTexts(thrown), modified.postings) : [],
      proof,
    };
    post({ type: 'invalid-report', report, workerIsolated: scope.crossOriginIsolated });
  } catch (error) {
    fail(progress, error);
  } finally {
    await destroyQuietly(api);
  }
}

let started = false;

scope.addEventListener('message', (event) => {
  const data: unknown = event.data;
  if (started || !isPageToWorker(data)) return;
  started = true;
  void (data.type === 'run' ? run() : runInvalid());
});
