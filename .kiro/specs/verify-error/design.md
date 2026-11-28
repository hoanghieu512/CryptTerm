# Design Document: verify-error

## Overview

`verify-error` replaces the boolean result of the proof check with a three-way `ProofOutcome` (`'valid' | 'invalid' | 'not_completed'`), so a timeout, a worker error or a `failed` event is reported to the judge as `REJECTED: VERIFIER ERROR` instead of the misleading `REJECTED AT PROOF`. The change is local to three files plus their tests: `src/zk/verify-client.ts`, `src/zk/verifier.ts`, and the CTM900 model in `src/ui/model/verify-flow.ts`. Nothing in `src/ui/model/screens/ctm900.ts` changes: its existing kind-based branches (`outcome.kind === 'error'` vs `'report'`) already draw the right thing once the upstream classification is correct. The verifier keeps failing closed (security.md section 5): a check that did not finish is never shown as `VERIFIED`, and it is now also never shown as the specific claim "PROOF INVALID".

## Architecture

No new files and no new dependency edges. The existing chain stays `ui -> zk -> ledger`:

```mermaid
flowchart LR
  W[Verify_Worker] -->|verified / failed event, port error, timeout| C[verify-client.ts<br/>createProofVerifier]
  C -->|ProofOutcome| S[verifier.ts<br/>proofStep]
  S -->|PROOF step: ok, detail| R[VerifyReport]
  R -->|action.report| M[verify-flow.ts<br/>normalizeReport]
  M -->|passed: number \| null| ScreenOutcome[VerifyOutcome]
  ScreenOutcome --> ctm900[ctm900.ts<br/>verdictText - unchanged]
```

`ProofOutcome` is the one new type, defined in `verifier.ts` next to the `ProofVerifier` type it replaces the return type of (keeping the existing import direction: `verify-client.ts` imports both as types from `verifier.ts`, `verifier.ts` imports `createProofVerifier` as a value from `verify-client.ts`).

## Components and Interfaces

### `src/zk/verifier.ts`

```ts
export type ProofOutcome = 'valid' | 'invalid' | 'not_completed';

// Checks a proof against the shipped key. Never throws, never rejects.
export type ProofVerifier = (proof: Uint8Array, publicInputs: readonly [string, string, string]) => Promise<ProofOutcome>;

export const NOT_COMPLETED_DETAIL = 'PROOF CHECK NOT COMPLETED';

export const VERIFY_DETAILS: Readonly<Record<VerifyStepName, { readonly ok: string; readonly fail: string; readonly notCompleted?: string }>> = {
  FORMAT: { ok: '...', fail: '...' },
  // ... SIGNATURE, DIGEST_MATCH, POLICY, CIRCUIT unchanged ...
  PROOF: { ok: 'PROOF VALID', fail: 'PROOF INVALID', notCompleted: NOT_COMPLETED_DETAIL },
};
```

`notCompleted` is optional on the shared record type and present only on `PROOF`; it is the "one new fixed text in `VERIFY_DETAILS`" the requirements name. `NOT_COMPLETED_DETAIL` is exported directly so `verify-flow.ts` can compare against it without reaching into `VERIFY_DETAILS.PROOF`.

`proofStep` now returns a `ProofOutcome` and absorbs requirement 2.4 itself, so nothing upstream needs its own guard:

```ts
export async function proofStep(deps: VerifierDeps, bundle: ProofBundle, policy: VerifyPolicy): Promise<ProofOutcome> {
  const inputs = [bundle.merkleRoot.toString(10), String(bundle.recordCount), policy.limitCents.toString(10)] as const;
  try {
    const result = await deps.verifyProof(bundle.proof, inputs);
    return result === 'valid' || result === 'invalid' ? result : 'not_completed';
  } catch {
    return 'not_completed';
  }
}
```

`createVerifier` pulls `PROOF` out of the generic `checks` loop (which still runs `SIGNATURE`, `DIGEST_MATCH`, `POLICY`, `CIRCUIT` exactly as today, unchanged order and results) and records it from the three-way outcome instead of a boolean:

```ts
const outcome = await proofStep(deps, bundle, policy);
const ok = outcome === 'valid';
const detail = outcome === 'not_completed' ? NOT_COMPLETED_DETAIL : VERIFY_DETAILS.PROOF[ok ? 'ok' : 'fail'];
steps.push({ name: 'PROOF', ok, detail });
if (!ok) return rejected(steps);
return { verdict: 'VERIFIED', steps };
```

`record()`'s existing shape (`push` then return `ok`) is unaffected for the other four checks; `PROOF` is pushed directly because its detail is no longer a pure function of `ok` alone. The whole `createVerifier` body stays inside its existing outer `try`/`catch`, so a bug in this new code still falls back to `rejected(steps)` rather than throwing (defense in depth; `proofStep` itself is already guarded).

### `src/zk/verify-client.ts`

`createProofVerifier` resolves a `ProofOutcome` instead of a boolean, built from a single mapping of each trigger to an outcome:

| Trigger | Resolves |
|---|---|
| `verified` event, `valid: true` | `'valid'` |
| `verified` event, `valid: false` | `'invalid'` |
| `failed` event | `'not_completed'` |
| port `onError` | `'not_completed'` for every still-pending run |
| `port.post` throws | `'not_completed'` for every still-pending run |
| timeout (`timeoutMs` elapses) | `'not_completed'` for every still-pending run |
| any trigger for a run already settled | no-op (the `pending` map no longer has that run id) |

`VERIFY_TIMEOUT_MS` changes from `60_000` to `120_000`; the `timeoutMs` parameter and its default-argument wiring are otherwise unchanged. `onMessage`, `dropPort`, `failAll` and the `pending` map need no structural change: they already resolve through one `resolve: (valid: boolean) => void` callback per run, which becomes `resolve: (outcome: ProofOutcome) => void`. `isWorkerEvent` and the worker side (`worker-core.ts`, `worker-protocol.ts`) are untouched: the `verified`/`failed` event shapes already carry everything this mapping needs.

### `src/ui/model/verify-flow.ts`

`normalizeReport`'s header comment says "the `detail` of a step is never read." This spec adds one narrow, documented exception: when the last step is `PROOF` and it failed, `normalizeReport` compares its `detail` with `NOT_COMPLETED_DETAIL` using `===`, and only to pick which of two existing return paths to take. It never copies, logs or re-displays the text; the comparison result, not the text, is what propagates.

```ts
if (verdict === 'VERIFIED') return steps.length === VERIFY_STEP_ORDER.length ? steps.length : null;
const lastStep = steps[last] as { readonly name?: unknown; readonly detail?: unknown };
if (lastStep.name === 'PROOF' && lastStep.detail === NOT_COMPLETED_DETAIL) return null;
return last;
```

Returning `null` here reuses the existing malformed-report path exactly: `onVerifyDone` → `settleRun(state, null, null)` → `{ kind: 'error' }` → `ctm900.ts`'s existing `outcome.kind === 'error'` branch → `MESSAGES.VERIFIER_ERROR`. A `PROOF` failure with any other text (in practice, `VERIFY_DETAILS.PROOF.fail`, `'PROOF INVALID'`) falls through to `return last`, the existing `REJECTED AT PROOF` path, unchanged. This is why `src/ui/model/screens/ctm900.ts` itself needs no code change: `verdictText` and `resultFields` already branch on `outcome.kind`, which is now set correctly one layer below.

## Data Models

No new state field. `VerifyOutcome`, `VerifyState`, `SystemAction` (`VERIFY_DONE` / `VERIFY_FAILED`) are all unchanged shapes; only the value that `normalizeReport` returns for one specific report shape changes (a `PROOF`-fails-with-`NOT_COMPLETED_DETAIL` report now yields `null` where it previously yielded `5`).

| Type | Before | After |
|---|---|---|
| `ProofVerifier` return | `Promise<boolean>` | `Promise<ProofOutcome>` |
| `proofStep` return | `Promise<boolean>` | `Promise<ProofOutcome>` |
| `VerifyStep` for `PROOF`, outcome `not_completed` | `{ ok: false, detail: 'PROOF INVALID' }` | `{ ok: false, detail: 'PROOF CHECK NOT COMPLETED' }` |
| `normalizeReport` for that report | `5` | `null` |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Proof_Client outcomes are deterministic, exhaustive and sticky

For any sequence of triggers (a `verified` event with either `valid` value, a `failed` event, a port error, a `post` throw, or a timeout of any duration) applied to any set of concurrently pending runs, each run resolves to exactly one of `'valid'`, `'invalid'` or `'not_completed'`, consistent with the mapping table above, and once a run has resolved, no later trigger for that run changes the resolved value.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.2, 3.3**

### Property 2: PROOF step detail comes only from the fixed set, keyed by outcome

For any stand-in proof check that answers `'valid'`, answers `'invalid'`, throws, rejects, or resolves to a value that is neither `'valid'` nor `'invalid'` (each carrying a distinct injected sentinel string when it throws or rejects), the `PROOF` step of the resulting report has `ok` and `detail` determined only by which of the three outcomes the check produced (`valid` → ok, `'PROOF VALID'`; `invalid` → not ok, `'PROOF INVALID'`; anything else → not ok, `'PROOF CHECK NOT COMPLETED'`), the verdict is `REJECTED` whenever `ok` is false, and the injected sentinel string never appears anywhere in the report.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: The Verify_Model shows VERIFIER ERROR only for a check that did not finish

For any well-formed report whose last step fails at `PROOF`, the Verify_Model stores outcome kind `error` and shows the Verifier_Error_Text when that step's detail is `'PROOF CHECK NOT COMPLETED'`, and shows `REJECTED AT PROOF` when it is `'PROOF INVALID'`; for any well-formed report that fails earlier, or passes all six steps, this PROOF-detail distinction plays no role, and `VERIFIED` is shown only when all six steps passed.

**Validates: Requirements 2.7, 2.8, 2.10**

## Error Handling

- `proofStep` never throws or rejects: a throw or rejection from `deps.verifyProof`, or a resolved value other than `'valid'`/`'invalid'`, is caught and folded into `'not_completed'` before it leaves the function. This mirrors the existing fail-closed rule for the other four steps and is what makes requirement 2.4 unconditional rather than dependent on the caller.
- `createVerifier`'s outer `try`/`catch` is unchanged and still guarantees `rejected(steps)` (never a throw) if anything in the new PROOF handling misbehaves.
- `createProofVerifier` keeps its existing contract: it never rejects. The only change is the resolved value's type and the longer default timeout.
- No detail string is ever built from a caught error, a timer value or a worker message; `NOT_COMPLETED_DETAIL` and the other `VERIFY_DETAILS` entries are the only strings a `VerifyStep.detail` can hold (security.md section 4, "every constraint needs ... detail is a fixed text").

## Testing Strategy

**Unit tests** (examples and edge cases):

- `VERIFY_TIMEOUT_MS` equals `120_000` (requirement 3.1).
- The boundary of the default timeout: a pending run is still pending at 119,999 ms and resolves `'not_completed'` at 120,000 ms, under fake timers (requirement 3.2, edge case of Property 1).
- `ctm900_verifier_error_row` includes concrete examples for the two PROOF-fail-detail cases and confirms neither shows `VERIFIED`.

**Property tests** (fast-check with Vitest, minimum 100 iterations each, tagged with the design property):

- `verify_client_outcomes` — **Feature: verify-error, Property 1**. Drives `createProofVerifier` against a fake `WorkerPort` with randomized trigger sequences and a randomized (sometimes injected, sometimes default) timeout.
- `proof_step_not_completed` — **Feature: verify-error, Property 2**. Drives `proofStep`/`createVerifier` with the five stand-in kinds (`'valid'`, `'invalid'`, throw, reject, non-matching value) each carrying a random sentinel string, asserting the PROOF step's `ok`/`detail` and the sentinel's absence from the whole report.
- `ctm900_verifier_error_row` — **Feature: verify-error, Property 3**. Drives `normalizeReport` (and, through it, `settleRun`/`verdictText`) with well-formed reports failing at each of the six steps, and at `PROOF` with each of the two fixed fail-detail texts, asserting the resulting `VerifyOutcome` kind and rendered Verdict_Row text.

**Existing tests that change** (mechanical, boolean-to-`ProofOutcome` only, per requirements.md scope):

- `tests/support/signed-bundle.ts`: `recordingVerifier(result)` takes and returns `'valid' | 'invalid'` instead of `boolean`. Its call sites that pass an explicit boolean literal update to the matching string: `tests/zk/verifier-order.prop.test.ts` (`recordingVerifier(!faults.has('PROOF'))` → `recordingVerifier(faults.has('PROOF') ? 'invalid' : 'valid')`) and `tests/ui/verify-bad-inputs.prop.test.ts` (`recordingVerifier(true)` → `recordingVerifier('valid')`). Calls using the default (`recordingVerifier()`) need no change if the default becomes `'valid'`.
- `tests/zk/verify-never-throws.prop.test.ts`: the stand-in kinds `'true'`/`'false'` return `'valid'`/`'invalid'`; `'throw'`, `'reject'` and `'nonBoolean'` resolve `'not_completed'`. `expectedLast` still names `'PROOF'` as the last step for every non-`'true'` kind, since `not_completed` also fails the step. `ALL_DETAILS` (built from `Object.values(VERIFY_DETAILS)`) extends its `flatMap` to include `d.notCompleted` where present, so the new fixed text is recognized as valid.

All other existing tests (`verifier_order`, `verify_unknown_key`, `verifier_compare`, `worker_hygiene`, the prover-side tests, and every e2e spec) are unaffected: none of them assert `VERIFY_TIMEOUT_MS === 60_000`, assert `false` for a timeout/worker-error/post-failure/`failed` event, or depend on `proofStep`'s return type directly.
