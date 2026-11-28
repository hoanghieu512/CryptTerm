# Requirements Document

## Introduction

`verify-error` fixes one wrong message on the verifier. Today `createProofVerifier` in `src/zk/verify-client.ts` resolves `false` for a timeout (`VERIFY_TIMEOUT_MS`, 60 s), a worker error, a post failure and a `failed` event (the worker sends `ASSET_FAILED` when `openVerifier` throws). `src/zk/verifier.ts` records every `false` as the step `PROOF` failed with the detail `PROOF INVALID`. On a slow or loaded machine a valid proof is then shown as invalid. This was seen once in the release remote e2e under load.

The verifier keeps failing closed. It only stops claiming that a proof is invalid when the check did not finish.

Scope: `src/zk/verify-client.ts`, `src/zk/verifier.ts` (the `ProofVerifier` type, `proofStep`, and one new fixed text in `VERIFY_DETAILS`), the CTM900 verdict mapping in `src/ui/model/screens/ctm900.ts` and the outcome kind `error` in `src/ui/model/verify-flow.ts`, and the tests of these files. huynh approved these `src/zk` changes for this spec only.

Out of scope and not touched: `worker-core.ts`, `worker-protocol.ts`, the prover side, `src/ledger`, the circuit and the bundle codec. The steps `FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY` and `CIRCUIT`, their texts and their order do not change.

Existing tests keep passing unchanged, except for these, which assert or build the old boolean contract of the proof check. Each change is mechanical (the stand-in returns a Proof_Outcome instead of a boolean) and is listed again in the tasks:

- `tests/support/signed-bundle.ts`: `recordingVerifier(result)` returns `'valid'` or `'invalid'` instead of `true` or `false`.
- `tests/zk/verify-never-throws.prop.test.ts`: the stand-in kinds `true` and `false` return `'valid'` and `'invalid'`, and the kinds `throw`, `reject` and `nonBoolean` are reported as not completed. The step they end at (`PROOF`) stays the same.
- Any test that asserts `VERIFY_TIMEOUT_MS` is 60,000 or asserts `false` for a timeout, a worker error, a post failure or a `failed` event. A search of `tests/` and `e2e/` found none outside the two files above, so no further change is expected.

## Glossary

- **Proof_Check**: The call that checks one proof against the shipped verification key. In the page it runs in the Verify_Worker. In tests it is a stand-in passed as `verifyProof` in `VerifierDeps`.
- **Proof_Outcome**: The result of a Proof_Check, exactly one of `valid`, `invalid` or `not_completed`. It replaces the boolean result of the type `ProofVerifier`.
- **Proof_Client**: `createProofVerifier` in `src/zk/verify-client.ts`. It sends a `verify` message to the Verify_Worker and resolves one Proof_Outcome. It never rejects.
- **Verify_Worker**: The worker that runs the Proof_Check, with its own port, apart from the worker of the prover.
- **Verifier**: `createVerifier` and `verifyBundle` in `src/zk/verifier.ts`. It runs the steps in the order of `tech.md` and builds a Verify_Report.
- **Verify_Report**: The `VerifyReport` value: a verdict of `VERIFIED` or `REJECTED` and the steps that ran. Each step has a name, an `ok` flag and a `detail`.
- **Fixed_Detail**: A text of `VERIFY_DETAILS`. A `detail` of a step is always one of these texts and never holds a thrown error, a code, a timer value, a worker message or a value from the input.
- **Not_Completed_Detail**: The new Fixed_Detail `PROOF CHECK NOT COMPLETED`, the `fail` text used for the step `PROOF` when the Proof_Outcome is `not_completed`.
- **Verify_Model**: The pure terminal state code that serves CTM900: `src/ui/model/verify-flow.ts` and `src/ui/model/screens/ctm900.ts`.
- **Verdict_Row**: Body row 17 of CTM900, the row that carries the verdict text.
- **Verifier_Error_Text**: `MESSAGES.VERIFIER_ERROR`, which reads `REJECTED: VERIFIER ERROR`.

## Requirements

### Requirement 1: Three outcomes of the proof check

**User Story:** As a verifier user, I want the proof check to say whether it finished, so that a slow or broken check is not reported as an invalid proof.

#### Acceptance Criteria

1. WHEN the Verify_Worker sends a `verified` event with `valid` equal to `true` for a pending run, THE Proof_Client SHALL resolve `valid` (covered by test `verify_client_outcomes`).
2. WHEN the Verify_Worker sends a `verified` event with `valid` equal to `false` for a pending run, THE Proof_Client SHALL resolve `invalid` (covered by test `verify_client_outcomes`).
3. WHEN the Verify_Worker sends a `failed` event for a pending run, THE Proof_Client SHALL resolve `not_completed` (covered by test `verify_client_outcomes`).
4. WHEN the port of the Verify_Worker reports an error, THE Proof_Client SHALL resolve `not_completed` for every pending run (covered by test `verify_client_outcomes`).
5. IF posting the `verify` message throws, THEN THE Proof_Client SHALL resolve `not_completed` for every pending run (covered by test `verify_client_outcomes`).
6. WHEN the timeout elapses before a pending run has a `verified` or `failed` event, THE Proof_Client SHALL resolve `not_completed` for every pending run (covered by test `verify_client_outcomes`, with a short injected timeout).
7. WHEN an event arrives for a run that has already resolved because of a timeout, THE Proof_Client SHALL leave every resolved Proof_Outcome unchanged (covered by test `verify_client_outcomes`).
8. THE Proof_Client SHALL resolve with exactly one of the three Proof_Outcome values and SHALL carry no error text, timer value or worker message with it (covered by test `verify_client_outcomes`, which checks the resolved value of every case with strict equality against the three strings).

### Requirement 2: Honest report and CTM900 verdict

**User Story:** As a verifier user, I want a check that did not finish to be shown as a verifier error, so that a real invalid proof and a slow machine look different and the verdict still never reads VERIFIED.

#### Acceptance Criteria

1. WHEN the Proof_Outcome is `valid`, THE Verifier SHALL record the step `PROOF` as passed with the detail `PROOF VALID` (covered by the existing tests `verifier_order` and `verify_never_throws`).
2. WHEN the Proof_Outcome is `invalid`, THE Verifier SHALL record the step `PROOF` as failed with the detail `PROOF INVALID` and the verdict `REJECTED` (covered by test `proof_step_not_completed`, invalid case).
3. WHEN the Proof_Outcome is `not_completed`, THE Verifier SHALL record the step `PROOF` as failed with the Not_Completed_Detail and the verdict `REJECTED` (covered by test `proof_step_not_completed`).
4. IF the Proof_Check throws, rejects, or answers anything other than `valid` or `invalid`, THEN THE Verifier SHALL treat the Proof_Outcome as `not_completed` (covered by test `proof_step_not_completed`, which uses a throwing, a rejecting and a non-string stand-in, and by the existing test `verify_never_throws`).
5. THE Verifier SHALL build every `detail` of a Verify_Report from a Fixed_Detail, so that no error text, timer value or worker message reaches the report (covered by test `proof_step_not_completed`, which plants a distinctive text in each failure and finds it nowhere in the report).
6. THE Verifier SHALL keep the order and the results of the steps `FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY` and `CIRCUIT` as they are (covered by the existing test `verifier_order`, unchanged).
7. WHEN a Verify_Report ends with the step `PROOF` failed with the Not_Completed_Detail, THE Verify_Model SHALL store the outcome kind `error`, so that the Verdict_Row shows the Verifier_Error_Text (covered by test `ctm900_verifier_error_row`).
8. WHEN a Verify_Report ends with the step `PROOF` failed with the detail `PROOF INVALID`, THE Verify_Model SHALL show `REJECTED AT PROOF` on the Verdict_Row (covered by test `ctm900_verifier_error_row`).
9. IF a Verify_Report is malformed, THEN THE Verify_Model SHALL store the outcome kind `error`, as before (covered by the existing tests of `normalizeReport` and `verdict_row_inverse`, unchanged).
10. THE Verify_Model SHALL show `VERIFIED` only for a Verify_Report with six passed steps (covered by the existing test `verdict_row_inverse` and by test `ctm900_verifier_error_row`, which checks that neither the invalid nor the not-completed case shows `VERIFIED`).

### Requirement 3: Longer proof check timeout

**User Story:** As a verifier user on a slow machine, I want the proof check to wait longer before it gives up, so that a valid proof has time to finish.

#### Acceptance Criteria

1. THE Proof_Client SHALL export `VERIFY_TIMEOUT_MS` with the value 120,000 (covered by test `verify_client_outcomes`, which compares the exported constant with `120_000`).
2. WHEN `createProofVerifier` is called without a timeout argument, THE Proof_Client SHALL use `VERIFY_TIMEOUT_MS` as its timeout (covered by test `verify_client_outcomes`, which runs fake timers and checks that a pending run is still pending at 119,999 ms and resolves `not_completed` at 120,000 ms).
3. WHERE a timeout argument is passed to `createProofVerifier`, THE Proof_Client SHALL use that value instead of `VERIFY_TIMEOUT_MS` (covered by test `verify_client_outcomes`, which uses a short injected timeout).
