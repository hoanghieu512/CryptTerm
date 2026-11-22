# Requirements Document

## Introduction

`zk-core` is the production proving and verifying core for CryptTerm, built on `zk-spike` and `ledger-format`. It adds a fast pre-check (`checkBatch`), a Web Worker that proves a signed batch (`proveBatch`), a proof bundle format with an encoder and decoder, generated circuit identity constants, and a verifier (`verifyBundle`) that never throws. The UI specs (`terminal-ui`, `verifier`) call these APIs and add no logic of their own.

Reuse, not duplication. `src/zk/prover.ts` (`PROOF_SETTINGS`, `createBb`, `executeCircuit`, `proveCircuit`, `verifyProofWithVk`, `decodePublicInputs`), `witness-builder.ts` (`buildCircuitInputs`), `circuit-inputs.ts`, `srs.ts`, `srs-assets.ts`, `artifact.ts`, `hash.ts`, `merkle.ts`, `batch-root.ts`, and from `src/ledger` the `Batch` type, `parseBatch`, `checkInvariants`, `LIMIT_CENTS`, `digestMessage`, `verifyDigest`, `SignedDigest` and `TRUSTED_SOURCE_KEYS`. All of these exist today with the names used here. New code lives in new files. Two existing files get edits, and both edits are exports only. `src/zk/artifact.ts` gains the new exports `VK_URL` and `loadVkFromUrl` (the verification key loader). `src/ledger/digest.ts` gains new exports for the exact-key rule and the two hex patterns (root and signature) that the new `src/ledger/digest-shape.ts` (`isSignedDigestShape`) imports. Neither file changes in any other way. If any other existing `src/zk` or `src/ledger` file must change, or either of these two files must change beyond adding those exports, work stops and huynh is asked.

Constraints that apply to every requirement:

- The spike files (`spike*.ts`, `spike.html`) stay untouched. A later task in the last group removes them, after the `worker_browser_e2e` check exists.
- The first task makes two steering edits: `tech.md` "Verifier order" gets `FORMAT` as the first step, and `noir.md` gets the verification key hash rule. No other steering file changes (test: `steering_edits_present`, example, which checks that `tech.md` lists `FORMAT` before the signature step and that `noir.md` states the verification key hash rule).
- The circuit and the committed Artifact `src/zk/artifacts/ledger_audit.json` do not change. Only new `nargo` tests are added.
- A task is marked completed only after its "Done when" check has run in the session and the report quotes the command and its output (`structure.md`, "Evidence before status").
- Amounts are `bigint` cents. No `Number`, `parseFloat` or `parseInt` on an amount. Every amount is in `0 <= amount < 2^40`.
- Proving and verifying run only in a Web Worker, single-threaded by default, with no COOP/COEP assumption.
- Property tests use fast-check with a fixed, logged seed (`tests/support/pbt.ts`, `runProperty`) and the run counts named below. Full-proof tests live in `tests/zk/proof/` and run only in `npm run test:proof`. Cheap tests run in `npm test`.
- The Prove_Service and the Verify_Worker creation in the Verifier take an injected Worker_Port, so that Node tests run the worker logic without a browser `Worker`. The browser build passes a real `Worker` as the Worker_Port.
- The Playwright e2e runs only against the local harness on localhost, opens no external URL, and downloads no browser. It uses the cached Chromium, and the task stops and asks huynh if that browser is missing. `@playwright/test` is pinned at 1.62.0.
- Which existing hashing and Noir environment helpers the tests share (`tests/support/zk-env.ts`) is a design decision.
- How the verification key is computed with `bb.js` 6.0.0 without a prove call is a design-phase research item. This document fixes behavior only.

## Glossary

- **Pre_Check**: `checkBatch` in a new file in `src/ledger`.
- **Prove_Service**: `proveBatch`, `cancelProve` and `ProveError` in `src/zk`, the promise API that the UI calls.
- **Worker_Module**: `src/zk/worker.ts`, the one source file of the Web Worker that runs `noir_js` and `bb.js`. The Prove_Service and the Verifier each create their own worker instance from it.
- **Prove_Worker**: The worker instance that the Prove_Service creates from the Worker_Module and uses to prove.
- **Verify_Worker**: The separate worker instance that the Verifier creates from the Worker_Module and uses only for the `PROOF` step. It shares no state with the Prove_Worker.
- **Worker_Port**: The minimal message-port interface (post a message, receive messages, terminate) through which the Prove_Service and the Verifier talk to a worker. A browser `Worker` and a Node test double both satisfy it.
- **Proof_Bundle**: The public JSON document that a proof produces. Its TypeScript type is `ProofBundle`.
- **Bundle_Codec**: `bundleToJson`, `encodeBundleForUrl`, `decodeBundle` and `BundleFormatError` in `src/zk`.
- **Public_Inputs_Field**: The `public_inputs` field of the Proof_Bundle (TypeScript `publicInputs`), an array of exactly 3 canonical decimal strings in circuit order `[merkle_root, record_count, limit_cents]`, which holds the public inputs that the prover used. The Verifier only compares it and never uses it as a proof input.
- **Verifier**: `verifyBundle` and `VerifyReport` in `src/zk`.
- **Circuit_Identity**: The generated constants `CIRCUIT_VERSION` and `VK_HASH` and the shipped verification key file, all under `src/zk`.
- **Identity_Script**: The build script in `scripts/` that produces the Circuit_Identity from the committed Artifact.
- **Circuit_Tests**: The `nargo test` cases in `circuits/ledger_audit/src/tests.nr`.
- **E2E_Build**: The build output of the e2e harness, which is the build that imports the Prove_Service and the Verifier.
- **Auditor_Agent**: The Kiro CLI custom agent defined in `.kiro/agents/circuit-auditor.json`.

## Requirements

### Requirement 1: Batch pre-check

**User Story:** As a prover, I want a fast check of a batch against the circuit rules, so that the terminal can show a clear message before any proving work starts.

#### Acceptance Criteria

1. WHEN a `Batch` and a `limitCents` are given, THE Pre_Check SHALL return `{ ok: true }` or `{ ok: false, reason }`, where `reason` is `OUT_OF_RANGE`, `UNBALANCED` or `OVER_LIMIT_UNFLAGGED` (test: `checkBatch_matches_circuit`)
2. FOR ALL generated batches, including boundary amounts (`2^40 - 1`, `2^40`, values near `2^53` and near `FIELD_MODULUS`), posting counts 0 to 65, and limits at both ends of `[0, 2^40)`, executing the circuit through `buildCircuitInputs` and `noir.execute` without proving SHALL succeed if and only if the Pre_Check returns `ok` (test: `checkBatch_matches_circuit`, execute only, 100 runs)
3. IF a batch breaks several rules, THEN THE Pre_Check SHALL return the first reason in this order: `OUT_OF_RANGE`, `UNBALANCED`, `OVER_LIMIT_UNFLAGGED`, which is the order of the circuit constraints (test: `checkBatch_reason_order`, example)
4. THE Pre_Check SHALL return a result for any `Batch` value without throwing, SHALL hold no posting value in the result, and SHALL use `bigint` arithmetic only (test: `checkBatch_matches_circuit`, which includes malformed field values, and `zk_static_scan`)
5. FOR ALL valid batches and every posting of a batch, changing that posting's amount by exactly 1 cent SHALL either make the Pre_Check fail or change `batchRoot` of the batch (test: `one_cent_change_detected`, 100 runs)

### Requirement 2: Circuit boundary tests

**User Story:** As a security reviewer, I want the padding and boundary cases deferred from the spike covered by `nargo test`, so that each constraint has a failing and a passing case.

#### Acceptance Criteria

1. THE Circuit_Tests SHALL include four tests that each place a non-zero value in one of `record_id`, `account`, `side` and `review_flag` of a padding slot, with every other field zero, and each SHALL fail with `PADDING SLOT NOT NEUTRAL` (tests: `padding_nonzero_record_id_fails`, `padding_nonzero_account_fails`, `padding_nonzero_side_fails`, `padding_nonzero_review_flag_fails`)
2. THE Circuit_Tests SHALL include a passing test with `record_count = 1` and a passing test with `limit_cents = 2^40 - 1` (tests: `record_count_1_passes`, `limit_2_pow_40_minus_1_passes`)
3. WHEN `nargo test` runs, THE Circuit_Tests SHALL pass, with each new failing case failing for its named assertion and not for an earlier one (test: `npm run test:circuit`)
4. WHEN `npm run build:circuit` runs after the new tests are added, THE committed Artifact SHALL keep sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`, and `circuits/ledger_audit/src/main.nr`, `hash.nr`, `merkle.nr` and `posting.nr` SHALL be unchanged (test: `artifact_sha_unchanged`, example, which compares the committed file and `ledger_audit.meta.json` with the full hash)

### Requirement 3: Prove a signed batch in a worker

**User Story:** As a prover, I want to turn a signed batch into a proof bundle in one call, so that the terminal shows progress and the page stays responsive.

#### Acceptance Criteria

1. WHEN `proveBatch(batch, digest, limitCents, onProgress?)` is called and no run is active, THE Prove_Service SHALL run the Pre_Check and the digest shape check (in either order), then witness building through `buildCircuitInputs`, circuit execution, and proof generation inside the Prove_Worker, and SHALL resolve a Proof_Bundle (test: `clean_sample_verified`, full proof)
2. THE Prove_Service SHALL call `onProgress` with stage names from one fixed list, in run order, and SHALL pass no other data (test: `worker_protocol`, no real proving)
3. IF the Pre_Check returns `ok: false`, THEN THE Prove_Service SHALL reject with a `ProveError` whose `reason` equals the Pre_Check reason, before any witness building or proving starts (test: `prove_precheck_rejects`, example, using the `unbalanced` and `over-limit-unflagged` samples)
4. THE Prove_Service SHALL prove the root computed from the given `batch`, SHALL copy `batchId`, `merkleRoot`, `recordCount`, `signature` and `sourceKeyId` from the given `digest` into the Proof_Bundle without comparing the two roots, and SHALL fill `publicInputs` from the public inputs that the proof actually used, as returned by the prover, so that an edited batch still yields a bundle that the Verifier can reject (tests: `move_one_cent_rejected_at_digest_match`, full proof; `prove_error_codes`, example asserting that `publicInputs` equals the stub prover's returned inputs and not the digest values)
5. THE Prove_Worker SHALL create the prover with `createBb` (single-thread WASM, `skipSrsInit`), SHALL load the Artifact and the SRS from the app's own origin through the existing loaders, and SHALL not read `crossOriginIsolated` or `SharedArrayBuffer` (test: `zk_static_scan`, example)
6. IF circuit execution throws although the Pre_Check returned `ok`, THEN THE Prove_Service SHALL reject with `ProveError` reason `WITNESS_FAILED`, and IF proof generation throws, THEN with reason `PROVER_FAILED` (test: `prove_error_codes`, example, with a stubbed prover)
7. IF the given `digest` fails the `SignedDigest` shape rules that `verifyDigest` and `SignedDigest` in `src/ledger` apply (field formats and hex lengths), THEN THE Prove_Service SHALL reject with a `ProveError` of reason `DIGEST_INVALID` before any witness building or proving starts, and SHALL still not compare the digest root with the batch root (test: `prove_digest_invalid`, example, with one malformed field per case)
8. WHEN the built app runs in Chrome without COOP/COEP headers and single-threaded, THE Prove_Service SHALL prove the `clean` sample in a real Web Worker and THE Verifier SHALL return `VERIFIED` for the resulting bundle (test: `worker_browser_e2e`, e2e, Playwright against the E2E_Build served locally by the e2e harness)

### Requirement 4: One run at a time, cancel, and error hygiene

**User Story:** As a prover, I want a second click to be refused and a cancelled run to leave no trace, so that the terminal never shows a result for a run I abandoned.

#### Acceptance Criteria

1. WHILE a prove run is active, THE Prove_Service SHALL reject a further `proveBatch` call immediately with `ProveError` reason `BUSY` and SHALL leave the active run unaffected (test: `worker_protocol`)
2. WHEN `cancelProve()` is called during a run, THE Prove_Service SHALL reject the pending promise with reason `CANCELLED`, terminate the worker, and accept a new `proveBatch` call afterwards (test: `worker_protocol`)
3. THE Prove_Service SHALL tag every run with an identifier and SHALL ignore any worker message that carries another identifier, so that a cancelled or superseded run never delivers a result or a progress call (test: `worker_protocol`, which sends a late result from a cancelled run and asserts that no promise settles and no callback fires)
4. THE `ProveError` `reason` SHALL be one of `BUSY`, `CANCELLED`, `UNBALANCED`, `OVER_LIMIT_UNFLAGGED`, `OUT_OF_RANGE`, `DIGEST_INVALID`, `ASSET_FAILED`, `WITNESS_FAILED` and `PROVER_FAILED` (nine reasons), and its message SHALL be a fixed text per reason (test: `prove_error_codes`, which covers all nine reasons)
5. THE messages from the Prove_Worker to the page, the `ProveError` values and every `onProgress` argument SHALL contain no posting value, account, amount, salt or witness value, and no part of a thrown `noir_js` or `bb.js` message (test: `worker_protocol`, which plants sentinel values in the batch, makes each stub stage throw a message that contains a sentinel, and scans all messages and errors for the sentinels)

### Requirement 5: Proof bundle format

**User Story:** As a verifier, I want a bundle that holds only public values in one exact shape, so that I can check it without trusting the prover.

#### Acceptance Criteria

1. THE Proof_Bundle JSON SHALL have exactly these keys, mapped from the TypeScript fields in one place in the Bundle_Codec: `batch_id` (`batchId`), `record_count` (`recordCount`), `merkle_root` (`merkleRoot`), `limit_cents` (`limitCents`), `signature`, `source_key_id` (`sourceKeyId`), `proof`, `circuit_version` (`circuitVersion`), `verification_key_hash` (`vkHash`) and `public_inputs` (`publicInputs`) (test: `bundle_allow_list`)
2. THE Proof_Bundle SHALL write `merkle_root` and `limit_cents` as canonical decimal strings with no sign and no leading zero, `record_count` as a JSON integer from 1 to 64, `signature` as 128 lowercase hex characters, `verification_key_hash` as 64 lowercase hex characters, `proof` as canonical base64, and `public_inputs` as an array of exactly 3 canonical decimal strings in circuit order `[merkle_root, record_count, limit_cents]` (test: `bundle_allow_list`, `decode_rejects_malformed`)
3. THE `proof` field SHALL hold only the proof bytes, as canonical base64 of 32-byte elements, non-empty and a multiple of 32 bytes, and THE `public_inputs` field SHALL be its own field, so that the Verifier can compare the inputs the prover used with the signed digest without parsing the proof (tests: `bundle_allow_list`, `digest_match_compares_public_inputs`)
4. WHEN `proveBatch` resolves, THE Proof_Bundle keys SHALL equal the allow-list above (`bundle_allow_list`, which includes `public_inputs`), and no value of any posting field SHALL appear as a bundle value other than through the public fields (test: `bundle_allow_list`, which runs on the bundle from `clean_sample_verified` and on a stubbed run with sentinel postings)

### Requirement 6: Bundle encode and decode

**User Story:** As a verifier, I want to open a bundle from pasted text or a shareable URL, so that CTM900 needs one entry point.

#### Acceptance Criteria

1. WHEN a `ProofBundle` is given, THE Bundle_Codec SHALL return its canonical JSON text through `bundleToJson` with a fixed key order, and its URL form through `encodeBundleForUrl`, which holds only characters that a URL fragment allows without escaping (test: `decode_roundtrip`)
2. WHEN a string is given, THE Bundle_Codec SHALL accept either the canonical JSON text or the URL form through `decodeBundle`, and SHALL return a `ProofBundle` (test: `decode_roundtrip`)
3. FOR ALL valid `ProofBundle` values `b`, `decodeBundle(encodeBundleForUrl(b))` and `decodeBundle(bundleToJson(b))` SHALL deep-equal `b` (test: `decode_roundtrip`, 200 runs)
4. IF the input is longer than 1,048,576 characters, THEN THE Bundle_Codec SHALL throw a `BundleFormatError` with code `TOO_LARGE` before any parsing starts (test: `decode_rejects_malformed`, example with a 2 MB string)
5. IF the input has a syntax error, a missing key, an unknown key (a key named `__proto__` counts as unknown), a wrong type, a non-canonical value, a `merkle_root` of `FIELD_MODULUS` or more, a `record_count` outside 1 to 64, a `limit_cents` of `2^40` or more, a `public_inputs` value that is not an array of exactly 3 canonical decimal strings each below `FIELD_MODULUS`, or a `proof` that is empty or whose byte length is not a multiple of 32, THEN THE Bundle_Codec SHALL throw a `BundleFormatError` whose `code` is a fixed value from one list and whose message holds no fragment of the input (test: `decode_rejects_malformed`, 200 runs, which mutates valid bundles and plants sentinel text)
6. THE Bundle_Codec SHALL accept any `source_key_id`, `circuit_version` and `verification_key_hash` string up to 64 characters that fits its field rule, so that an unknown key id or a wrong version reaches the Verifier step that names it (test: `verify_never_throws`)

### Requirement 7: Circuit identity

**User Story:** As a verifier, I want the circuit version and key hash to come from the shipped Artifact, so that a bundle for another circuit is rejected by name.

#### Acceptance Criteria

1. WHEN the Identity_Script runs, THE Identity_Script SHALL write `CIRCUIT_VERSION`, `VK_HASH` and the verification key file under `src/zk`, each marked GENERATED, from the committed Artifact and `ledger_audit.meta.json` only (test: `circuit_identity_reproducible`, example)
2. THE `CIRCUIT_VERSION` SHALL be `nargo-1.0.0+` followed by the first 32 lowercase hex characters of the Artifact sha256 (for the committed Artifact, `nargo-1.0.0+2b08fea52a19e41a63589033287e3ee5`), which is 44 characters and within the 64-character cap of Requirement 6.6, and `VK_HASH` SHALL be the SHA-256 of the verification key bytes as 64 lowercase hex characters, compared in full by the Verifier (test: `circuit_identity_reproducible`)
3. WHEN the Identity_Script runs twice on the same Artifact, THE Identity_Script SHALL produce byte-identical files, and the committed files SHALL equal a fresh run written to a temporary directory (test: `circuit_identity_reproducible`)
4. THE verification key file SHALL equal the verification key that `proveCircuit` returns for the committed Artifact (test: `shipped_vk_matches_prover_vk`, full proof)
5. IF the Artifact or its meta file is missing or unreadable, THEN THE Identity_Script SHALL exit with a non-zero status and write no file (test: `circuit_identity_missing_artifact`, example)
6. THE Identity_Script SHALL print only file names and the hash values that are public (test: `circuit_identity_reproducible`, which matches each stdout line)
7. WHEN the E2E_Build has run, THE E2E_Build output SHALL contain the verification key as its own file named `ledger_audit-<hash>.vk` by Vite's asset hashing, not inlined into any JavaScript or HTML file, and the sha256 of that file SHALL equal `VK_HASH`. The `terminal-ui` spec adds the same check on `dist` once the app imports the Prove_Service, because today's placeholder app imports nothing from `src/zk` and `npm run build` emits no key file (test: `dist_vk_asset`, example, which runs after the E2E_Build and checks the file name pattern and hash; it is a task "Done when" check and may be a script check instead of a Vitest test)

### Requirement 8: Verifier contract

**User Story:** As a verifier, I want one call that returns a named result for any input, so that CTM900 can show a checklist and never crashes.

#### Acceptance Criteria

1. WHEN `verifyBundle(input, policy)` is called, THE Verifier SHALL run the steps `FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY`, `CIRCUIT` and `PROOF` in this order, SHALL stop at the first step that fails, and SHALL return a `VerifyReport` whose `steps` hold each step that ran, up to and including the failing one (test: `verifier_order`, which injects one fault per step and a pair of faults that must report the earlier step)
2. THE Verifier SHALL set `verdict` to `VERIFIED` if and only if `steps` holds all six steps in order and each has `ok: true`, and otherwise to `REJECTED` (test: `verifier_order`)
3. THE Verifier SHALL resolve for every input and SHALL not throw or reject, and IF any step throws or rejects, THEN THE Verifier SHALL report that step with `ok: false` and verdict `REJECTED` (test: `verify_never_throws`, 300 runs over arbitrary strings, the empty string, a 2 MB string, a truncated valid bundle, a wrong `circuit_version`, a wrong `verification_key_hash` and an unknown `source_key_id`, each giving `REJECTED` with a named step)
4. IF `policy.limitCents` is not a `bigint` in `[0, 2^40)`, THEN THE Verifier SHALL report `POLICY` as failed after `FORMAT` and `SIGNATURE` have passed (test: `verifier_order`)
5. THE `detail` of each step SHALL be a fixed uppercase text taken from one table keyed by step and outcome, and SHALL contain no posting value, no fragment of the input and no thrown message (test: `verify_never_throws`, which asserts every `detail` is in the table)
6. THE Verifier SHALL run the `PROOF` step inside its own Verify_Worker instance, separate from the Prove_Worker of the Prove_Service, and SHALL run the other steps without a worker, so that an active prove run (reason `BUSY` for a second `proveBatch`) neither blocks nor affects verification (test: `worker_protocol`, example in which a prove run is active and a `verifyBundle` call still completes)

### Requirement 9: Verifier step rules

**User Story:** As a security reviewer, I want each verifier step to trust only what the verifier owns, so that a forged bundle cannot pass by supplying its own key, inputs or limit.

#### Acceptance Criteria

1. THE `SIGNATURE` step SHALL look up the public key in `TRUSTED_SOURCE_KEYS` by own property `source_key_id`, SHALL build a `SignedDigest` from the bundle fields (`merkle_root` as `0x` plus 64 lowercase hex characters), and SHALL pass only if `verifyDigest` returns true (tests: `verify_unknown_key`, example including the ids `__proto__` and `constructor`; `verify_never_throws`)
2. THE `DIGEST_MATCH` step SHALL pass only if `public_inputs[0]` equals `merkle_root` and `public_inputs[1]` equals `record_count` of the bundle, compared as canonical decimal strings (tests: `digest_match_compares_public_inputs`, property that includes the hand-built bundle examples; `move_one_cent_rejected_at_digest_match`, full proof, where a balanced 1-cent move between two postings gives `REJECTED` at `DIGEST_MATCH`)
3. THE `POLICY` step SHALL pass only if both `limit_cents` of the bundle and `public_inputs[2]` equal `policy.limitCents` (tests: `policy_compares_public_inputs_and_bundle_limit`, property that includes the hand-built bundle examples; `limit_2m_rejected_at_policy`, full proof, where a bundle proved with `limitCents` 2,000,000 against policy 1,000,000 gives `REJECTED` at `POLICY`)
4. THE `CIRCUIT` step SHALL pass only if `circuit_version` equals `CIRCUIT_VERSION` and `verification_key_hash` equals `VK_HASH` as exact strings, and the Verifier SHALL use only the shipped verification key and never a key from the bundle (tests: `verify_never_throws` for the wrong version and the wrong hash; `zk_static_scan` for the absence of any key field in the bundle type)
5. THE `PROOF` step SHALL build its public inputs from the signed `merkle_root` and `record_count` and from `policy.limitCents`, SHALL take only the proof bytes from the bundle and never read `public_inputs`, and SHALL check them against the shipped verification key through `verifyProofWithVk` (tests: `proof_step_uses_built_inputs`, example with a stubbed verify function that records its arguments and asserts that it receives inputs built from the signed fields and the policy limit even when `public_inputs` holds garbage; `flipped_proof_byte_rejected_at_proof`, full proof, where one flipped proof byte gives `REJECTED` at `PROOF`)
6. WHEN the `clean` sample is proved and its bundle is verified with policy 1,000,000, THE Verifier SHALL return `VERIFIED` with six passing steps (test: `clean_sample_verified`, full proof)

### Requirement 10: Static scan of the core

**User Story:** As a security reviewer, I want a test that keeps network, logging and storage calls out of the core, so that no hook is needed to catch them.

#### Acceptance Criteria

1. THE `src/zk` and `src/ledger` sources SHALL contain no `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `importScripts`, and no `fetch` call outside `src/zk/artifact.ts` and `src/zk/srs.ts`, where the existing same-origin guard applies (test: `zk_static_scan`, example)
2. THE `src/zk` and `src/ledger` sources SHALL contain no `console.*` call outside the spike files (test: `zk_static_scan`)
3. THE `src/zk` and `src/ledger` sources SHALL contain no `localStorage`, `sessionStorage`, `indexedDB`, `caches` or `document.cookie` use, and no `parseFloat` or `parseInt` (test: `zk_static_scan`)
4. THE `zk_static_scan` SHALL ignore comments, SHALL fail on any listed name in code, and SHALL list the spike files it skips by name (test: `zk_static_scan`, which also checks that the skip list holds only files that start with `spike`)
5. THE existing test `no_private_key_in_src` SHALL keep passing with the new files in place (test: `no_private_key_in_src`)

### Requirement 11: Circuit auditor agent

**User Story:** As huynh, I want a read-only Kiro CLI agent to audit the circuit and the witness code once, so that the write-up can show an independent review and what came of it.

#### Acceptance Criteria

1. THE Auditor_Agent SHALL be defined in `.kiro/agents/circuit-auditor.json` with read-only tools (no file write and no shell tool) and a prompt that covers Noir soundness (unconstrained values, range check before comparison, padding binding, explicit boolean constraints, public inputs) and TypeScript to circuit parity (hash variant, field encoding, leaf order, padding rule) (test: `auditor_agent_config`, example, which parses the file and checks the tool list and the prompt topics)
2. WHEN the Auditor_Agent runs once with `kiro-cli` over `circuits/ledger_audit`, `src/zk/witness-builder.ts` and `src/zk/batch-root.ts`, THE task SHALL record in `docs/writeup-notes.md` the command, the date, each finding and what was done about it (test: `auditor_notes_recorded`, example, which checks that the entry exists and names each file)
3. IF the audit reports a real soundness or parity finding, THEN THE task SHALL report it to huynh and SHALL change no circuit or witness code before huynh decides (no automated test; checked in the task evidence)
4. THE `.kiro/agents/` folder SHALL stay under version control (test: `auditor_agent_config`, which checks that `.gitignore` does not exclude it)

## Decisions

1. **Bundle key names (Requirements 5.1, 6.1).** The bundle JSON is snake_case and TypeScript is camelCase, through one mapping. The JSON key `verification_key_hash` maps to the TypeScript field `vkHash`. The committed `*.digest.json` files stay camelCase and do not change.
2. **Public inputs field (Requirements 3.4, 5.1 to 5.4, 6.5, 9.2, 9.3, 9.5).** The bundle has its own `public_inputs` field (`publicInputs`) with 3 canonical decimal strings in circuit order, and `proof` holds only proof bytes. `DIGEST_MATCH` and `POLICY` compare `public_inputs`, and `PROOF` builds its own inputs and never reads it. The `tech.md` "Proof bundle" section now has a one-line `public_inputs` addition.
3. **Decimal root (Requirements 5.2, 9.1).** `merkle_root` in the bundle is a decimal string, and the Verifier converts it to `0x` hex for `SignedDigest`.
4. **Added step and APIs (Requirements 3, 4, 6, 8.1).** The `FORMAT` step, `cancelProve` and `bundleToJson` are accepted.
5. **`checkBatch` placement (Requirement 1).** `checkBatch` lives in the new file `src/ledger/check-batch.ts` and `invariants.ts` stays unchanged.
6. **Artifact hash check (Requirement 2.4).** The artifact sha256 check is accepted, and the work stops if a rebuild differs.
7. **Separate verify worker (Requirement 8.6, Glossary).** The Verifier's `PROOF` step uses its own Verify_Worker instance, separate from the Prove_Worker, so a running proof never blocks verification.
8. **`CIRCUIT_VERSION` format (Requirement 7.2).** `CIRCUIT_VERSION` is `nargo-1.0.0+` plus the first 32 hex characters of the Artifact sha256 (44 characters, within the 64-character cap of 6.6). `VK_HASH` is compared in full.
9. **`DIGEST_INVALID` added (Requirements 3.1, 3.7, 4.4).** A digest that fails the `SignedDigest` shape rules is rejected with the new `ProveError` reason `DIGEST_INVALID` before witness building, which makes nine reasons. The design maps an unusable digest to `OUT_OF_RANGE` today and will be updated to match.
10. **Verification key loader exports (Introduction, Requirement 7).** `VK_URL` and `loadVkFromUrl` are added to `src/zk/artifact.ts` as new exports only. This is one of two existing-file edits, and both are exports only.
11. **Steering edits in the first task (Constraints).** `tech.md` "Verifier order" gets `FORMAT` as the first step, and `noir.md` gets the verification key hash rule. Both edits belong to the first task.
12. **Compare tests as properties (Requirements 9.2, 9.3).** `digest_match_compares_public_inputs` and `policy_compares_public_inputs_and_bundle_limit` are properties that include the hand-built examples.
13. **Injected Worker_Port (Constraints, Glossary).** The Prove_Service and the Verify_Worker take an injected Worker_Port, so Node tests run without a browser `Worker`.
14. **Built asset and browser checks (Requirements 3.8, 7.7).** `dist_vk_asset` runs on the E2E_Build output and checks that the verification key is a separate `ledger_audit-<hash>.vk` file whose sha256 equals `VK_HASH`. This is accepted. The `terminal-ui` spec adds the same check on `dist` once the app imports the Prove_Service. `worker_browser_e2e` is one Playwright check that proves and verifies the `clean` sample in a real Web Worker, and the spike files are removed only after it exists.
15. **Digest shape patterns (Introduction, Requirement 3.7).** `src/ledger/digest.ts` gains exports for the exact-key rule and the root and signature hex patterns, and `src/ledger/digest-shape.ts` imports them. The patterns are exported, not copied, so no drift test is needed. The `prove_digest_invalid` test stays.
16. **Local e2e only (Constraints).** The Playwright e2e runs only against the local harness on localhost, opens no external URL and downloads no browser. It uses the cached Chromium, and the task stops and asks if that browser is missing. `@playwright/test` is pinned at 1.62.0.
