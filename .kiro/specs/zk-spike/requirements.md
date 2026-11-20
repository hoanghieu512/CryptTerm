# Requirements Document

## Introduction

The zk-spike answers one question before any UI work starts: is in-browser UltraHonk proving of the real CryptTerm `ledger_audit` circuit fast enough on the target machine? The spike builds the real circuit at capacity N = 64 (Merkle tree depth 6), commits the compiled artifact, runs the circuit in a temporary spike page inside a Web Worker with a single-threaded `bb.js`, and records timings. A non-production Netlify deploy supplies the numbers for two gates: cold total under 30 s with normal CPU, and cold total under 60 s with Chrome DevTools 4x CPU throttling. Failing either gate means switching to option B.

The spike also settles open items in `.kiro/steering/noir.md`: the Poseidon variant and encodings shared by the circuit and TypeScript, and what `noir.execute` does when a constraint fails.

Out of scope: the batch file format, signing, UI screens, the verifier screen, a bb CLI cross-check of proofs and verification keys, and raising capacity to 128.

### Differences between the brief and the steering files

The brief takes precedence for this spike. Differences:

- `structure.md` says compiled artifacts are build outputs that the build copies into a place Vite serves. The brief commits the compiled artifact and its meta file to `src/zk/artifacts/`, because the Netlify build image has no `nargo`.
- `structure.md` lists `ledger-format` as the first planned spec. `zk-spike` runs before it and defines its own minimal posting fields, with no batch file format.
- `tech.md` allows raising capacity to 128 if the spike shows headroom. The spike measures N = 64 only.

### Deferred to zk-core

The following checks are not part of this spike and move to the later zk-core spec:

- The Oracle (a pure TypeScript decision function for witness validity) and the six witness-class properties that depend on it.
- The source scan of the spike files for forbidden APIs, with its allow-list, its self-test and the Luhn check on Spike_Witness account values.
- The default-build inspection check of `dist/` and the `build.target` check.
- The test that runs the Build_Script with `nargo` absent from `PATH`.

Until zk-core exists, the rules those checks would enforce (Requirement 7.4, Requirement 10, Requirement 11.1 and Requirement 11.4) stay in force and are verified by review of the spike source or by inspection of `dist/`.

## Glossary

- **Spike_Team**: The Kiro agent that executes this spec's tasks, acting for huynh.
- **Build_System**: The Vite build configuration and npm scripts in the repository root.
- **Circuit**: The Noir package at `circuits/ledger_audit`, compiled with `nargo` 1.0.0.
- **Posting**: One ledger entry with the fields `record_id`, `account`, `side`, `amount`, `review_flag` and `salt`. All six fields are private.
- **Capacity**: The fixed number of posting slots in the Circuit, named `N` and equal to 64.
- **Real_Slot**: A slot with index below `record_count`.
- **Padding_Slot**: A slot with index at or above `record_count`.
- **Padding_Posting**: The single fixed Posting value that every Padding_Slot holds, with amount 0. Its exact encoding is documented in Noir_Notes.
- **Leaf**: The hash of all six Posting fields of one slot, including `salt`.
- **Merkle_Root**: The root of the depth-6 Merkle tree over the 64 Leaves. Also the public input `merkle_root`.
- **Limit**: The public input `limit_cents`, an amount in integer cents.
- **Valid_Witness**: A set of private and public inputs for which every Circuit constraint holds.
- **Spike_Witness**: The fixed, committed, synthetic Valid_Witness with 64 Postings that the Spike_Worker proves.
- **Witness_Builder**: The TypeScript module under `src/zk/` that computes Leaves and the Merkle_Root with `bb.js` hashing and assembles Circuit inputs.
- **Hash_Variant**: The Poseidon variant, with its parameters, used for Leaves and inner nodes in both the Circuit and the Witness_Builder.
- **Artifact**: The compiled Circuit JSON at `src/zk/artifacts/ledger_audit.json`.
- **Artifact_Meta**: The file `src/zk/artifacts/ledger_audit.meta.json`, holding the `nargo` version and the sha256 of the Artifact.
- **Build_Script**: The script `scripts/build-circuit` that compiles the Circuit and writes the Artifact and Artifact_Meta.
- **Spike_Page**: The temporary page `spike.html` with its script `src/zk/spike.ts`.
- **Spike_Worker**: The Web Worker that runs `noir_js` and `bb.js` for the Spike_Page.
- **Cold_Run**: One run of the Spike_Page in Chrome on the first load of the deployed URL, with browser cache disabled or an empty cache, so that WASM download and initialisation are included.
- **Normal_Gate**: The target of a Cold_Run total under 30 s with no CPU throttling.
- **Throttled_Gate**: The target of a Cold_Run total under 60 s with Chrome DevTools 4x CPU throttling.
- **Option_B**: The fallback direction that applies when either gate fails: Circom with snarkjs.
- **Noir_Notes**: The steering file `.kiro/steering/noir.md`.
- **Results_Document**: The file `docs/spike-results.md`.
- **Spike_Deploy**: The non-production Netlify deploy of the spike build.
- **SRS_Files**: The committed `.dat` files under `src/zk/artifacts/srs/`: a prefix of the published Aztec ceremony g1 points file and the g2 file. Not spike-only.

## Requirements

### Requirement 1: Toolchain verification and exact pins

**User Story:** As the project owner, I want the exact toolchain versions confirmed and pinned before any code depends on them, so that the timings and API findings refer to a known stack.

#### Acceptance Criteria

1. WHEN the spike starts, THE Spike_Team SHALL run `nargo --version` and `npm ls @noir-lang/noir_js @aztec-foundation/bb.js`, compare each reported version with the pin table in Noir_Notes, and record the full output of both commands in the Results_Document.
2. IF the installed `nargo` version is not `1.0.0` or `nargo` is not installed, THEN THE Spike_Team SHALL stop work before writing any circuit code and report to huynh the installed version (or that `nargo` is missing) and the expected version `1.0.0`.
3. IF the `npm ls` output reports a version that differs from the pin table in Noir_Notes, or reports a package as missing, invalid or extraneous, THEN THE Spike_Team SHALL stop work before writing any code that uses these packages and report to huynh the package name, the reported version and the pinned version.
4. WHEN dependencies are added, THE Spike_Team SHALL list `@noir-lang/noir_js`, `@noir-lang/acvm_js`, `@noir-lang/noirc_abi` and `@noir-lang/types` in `package.json` at exactly `1.0.0`, and `@aztec-foundation/bb.js` at exactly `6.0.0`, with no `^`, `~`, `latest`, range operator or tag.
5. WHEN dependencies are added, THE Spike_Team SHALL check each package name and version against `npm view <package> dist-tags` and the published package contents, and SHALL treat the registry as authoritative over Context7 output.
6. IF `npm view` shows that a package name or the pinned version does not exist in the registry, THEN THE Spike_Team SHALL leave that package out of `package.json` and report to huynh the package name, the pinned version and the registry result.
7. THE Spike_Team SHALL NOT install `@aztec/bb.js`, so that `npm ls @aztec/bb.js` reports no installed package.
8. IF Context7 output disagrees with the npm registry on a package name or version, THEN THE Spike_Team SHALL append an entry to the version quirks log in Noir_Notes with the date in `YYYY-MM-DD` format, the package name, the Context7 value and the registry value.
9. WHEN Noir, `noir_js` or `bb.js` code or configuration is written, THE Spike_Team SHALL base the API usage on Context7 results for `/noir-lang/noir` or `/websites/noir-lang`, or on the published package source and type definitions, and SHALL NOT base it on memory, so that every such API usage traces to one entry in the "Lookups" section of the Results_Document.
10. WHEN a lookup is performed, THE Spike_Team SHALL record one entry in a "Lookups" section of the Results_Document containing the topic, the source and the version the lookup applies to.

### Requirement 2: Circuit interface and capacity

**User Story:** As a prover, I want a circuit with a fixed capacity and a minimal public interface, so that the timing measured in the spike represents the real circuit.

#### Acceptance Criteria

1. WHEN `nargo compile` runs on the package `circuits/ledger_audit` with `nargo` 1.0.0, THE Circuit SHALL compile with exit status 0 and zero reported errors.
2. THE Circuit SHALL define Capacity as a single named constant `N` with the value 64, and SHALL contain no other hard-coded capacity value that can differ from `N`.
3. THE Circuit SHALL build a Merkle tree of depth 6 over exactly 64 Leaves, with one Leaf per slot in slot order from index 0 to index 63.
4. THE Circuit SHALL expose exactly three public inputs, `merkle_root`, `record_count` and `limit_cents`, and SHALL expose no other public input and no public return value.
5. THE Circuit SHALL treat all six Posting fields (`record_id`, `account`, `side`, `amount`, `review_flag` and `salt`) of every one of the 64 slots as private inputs.
6. THE Circuit SHALL encode `side` with exactly two values, one for debit and one for credit, and no third value, and SHALL record the numeric value of each in Noir_Notes.
7. THE Circuit SHALL encode `review_flag` with exactly two values, one for set and one for not set, and no third value, and SHALL record the numeric value of each in Noir_Notes.
8. IF the value of `side` or `review_flag` in any slot is not one of its two encoded values, THEN THE Circuit SHALL cause witness execution to fail with an error and SHALL NOT return a witness.
9. IF the supplied inputs lack any of the three public inputs, or any slot array has a length other than 64, THEN THE Circuit SHALL cause witness execution to fail with an error and SHALL NOT return a witness.

### Requirement 3: Hash, leaf and padding encoding

**User Story:** As the author of the next spec, I want the hash variant and encodings written down and shared by the Circuit and TypeScript, so that TypeScript computes identical Leaves and roots.

#### Acceptance Criteria

1. THE Circuit SHALL compute every Leaf and every inner Merkle node with the Hash_Variant, using the same Hash_Variant for all 64 Leaves and all 63 inner nodes of the depth-6 tree.
2. THE Hash_Variant SHALL be a Poseidon variant for which `@aztec-foundation/bb.js` 6.0.0 computes in JavaScript the same output field element as the Noir computation in the Circuit, for the same ordered input field elements, for both the Leaf hash and the inner-node hash.
3. IF no Poseidon variant exists that both the Circuit and `bb.js` 6.0.0 compute identically, THEN THE Spike_Team SHALL stop work on hash-dependent code, SHALL report to huynh the variants tried, the input vectors, the output of each side and the package versions, and SHALL NOT adopt another hash until huynh approves it.
4. THE Circuit SHALL hash all six Posting fields (`record_id`, `account`, `side`, `amount`, `review_flag` and `salt`), including `salt`, as six ordered field elements in one fixed order into the Leaf.
5. WHEN the Results_Document is complete, THE Noir_Notes SHALL record, in its "Settled choices" section, the exact Hash_Variant name, its parameters, the field encoding of `record_id` and `account` with its maximum accepted length or value, the Leaf field order and layout, the Padding_Posting encoding, the Merkle tree layout (leaf index to position, left and right ordering) and the inner-node hash.
6. WHEN the Results_Document is complete, THE Noir_Notes SHALL record a yes or no answer on whether `bb.js` 6.0.0 completes a proof run single-threaded with `crossOriginIsolated` false, and SHALL list the settings (thread count and any Vite or worker configuration) that make that work.
7. THE Witness_Builder SHALL call the `bb.js` hash function for every Leaf and every inner node, and SHALL contain no Poseidon round constants, permutation code or field arithmetic that computes a hash.
8. FOR ALL valid 64-slot posting arrays with `record_count` in 1..64, THE Witness_Builder root SHALL equal the root that the Circuit recomputes, shown by `noir.execute` accepting the witness with that root as `merkle_root`, with at least 100 runs per property (root parity property).
9. THE Padding_Posting SHALL be one constant value with amount 0, identical in the Circuit and the Witness_Builder, so that every Padding_Slot Leaf is the Leaf hash of that same value.
10. IF a `record_id` or `account` value exceeds the maximum length or value that the documented field encoding accepts, THEN THE Witness_Builder SHALL reject the posting with an error that names the field and the slot index, SHALL NOT build Circuit inputs, and SHALL include no field value in the error.
11. THE test suite SHALL include at least one known-answer vector for the Leaf hash and one for the inner-node hash, each with fixed input field elements and the expected output field element recorded in Noir_Notes, and SHALL fail when the Witness_Builder output for those inputs differs from the recorded output.

### Requirement 4: Circuit constraints

**User Story:** As a verifier, I want the circuit to enforce every compliance invariant, so that a proof means the batch balances and respects the limit.

#### Acceptance Criteria

1. THE Circuit SHALL assert that the Merkle root recomputed with the Hash_Variant from the 64 Leaves, taken in slot order from index 0 to index 63, equals the public `merkle_root`.
2. THE Circuit SHALL assert that every amount in all 64 slots, including Padding_Slots, is at most 2^40 - 1 (1,099,511,627,775 cents), so that an amount of 2^40 is rejected and an amount of 2^40 - 1 is accepted.
3. THE Circuit SHALL assert that the sum of debit amounts over all 64 slots equals the sum of credit amounts over all 64 slots, computed without modular wraparound, where each Padding_Slot contributes 0 to both sums.
4. THE Circuit SHALL assert, for every Real_Slot, that `amount <= limit_cents` or `review_flag` is set, so that an amount equal to `limit_cents` is accepted without the flag and an amount of `limit_cents + 1` is accepted only with the flag set.
5. THE Circuit SHALL assert that every Padding_Slot holds all six fields of the Padding_Posting as documented in Noir_Notes, including amount 0, and that no Padding_Slot holds any other value.
6. THE Circuit SHALL assert that `record_count` is an integer in the inclusive range 1 to 64, so that the values 0 and 65 are rejected and the values 1 and 64 are accepted.
7. THE Circuit SHALL assert that `limit_cents` is at most 2^40 - 1, so that the comparison in criterion 4 operates on range-checked values and a `limit_cents` of 2^40 is rejected.
8. THE Circuit SHALL NOT contain an `unconstrained` function whose return value is used without a following assertion that verifies the value, as confirmed by inspection of the Circuit source.
9. THE Circuit SHALL NOT declare any floating-point type or signed-integer type for `amount`, `limit_cents` or `record_count`, as confirmed by inspection of the Circuit source.
10. IF a witness violates any constraint in criteria 1 to 7, THEN THE Circuit SHALL be unsatisfied for that witness, so that no proof for that witness verifies against the public inputs `merkle_root`, `record_count` and `limit_cents`.

### Requirement 5: Circuit tests written first

**User Story:** As a maintainer, I want the circuit tests to exist and fail before the constraints exist, so that each test demonstrably detects the constraint it covers.

#### Acceptance Criteria

1. THE Circuit SHALL contain in-source `nargo test` cases under `circuits/ledger_audit` with at least these nine tests: `valid_batch_passes`, `unbalanced_by_one_cent_fails`, `over_limit_unflagged_fails`, `over_limit_flagged_passes`, `amount_at_2_pow_40_fails`, `nonzero_padding_fails`, `wrong_root_fails`, `record_count_64_passes` and `record_count_0_fails`, and with these four boundary tests: `amount_2_pow_40_minus_1_passes`, `amount_equal_limit_unflagged_passes`, `record_count_65_fails` and `limit_at_2_pow_40_fails`, so that the Circuit contains at least thirteen named tests, eight whose names end in `_fails` and five whose names end in `_passes`.
2. THE Circuit SHALL declare each of the eight tests whose name ends in `_fails` with `#[test(should_fail_with = "...")]`, using the syntax confirmed by a lookup for `nargo` 1.0.0, and the expected message of each test SHALL be a different string that matches the message of the single constraint that test targets, with the `record_count` lower bound and the `record_count` upper bound implemented as two separate assertions that carry different messages. IF the lookup shows that `should_fail_with` cannot match the assertion of a constraint in `nargo` 1.0.0, THEN THE Spike_Team SHALL declare that test with `#[test(should_fail)]` and record the reason in the "Lookups" section of the Results_Document.
3. WHEN the thirteen named tests are written and the Circuit contains a compiling skeleton with no constraints for the behaviour under test, THE Spike_Team SHALL run `nargo test` and save the complete unmodified output and exit status, which SHALL show exactly the eight `_fails` tests as failed and the five `_passes` tests as passed.
4. WHEN the failing run is saved, THE Spike_Team SHALL store the output in the Results_Document under a "Tests written first" section, together with the `nargo --version` output and the run date, before adding any constraint.
5. WHEN all constraints are implemented, THE `nargo test` run SHALL report all thirteen named tests as passing, none as failing and none as skipped, and SHALL exit with status 0.
6. THE `unbalanced_by_one_cent_fails` test SHALL change exactly one amount of an otherwise Valid_Witness by exactly 1 cent, keep the changed amount below 2^40 and at or below `limit_cents` (or flagged), and keep the public `merkle_root` equal to the root of the changed Leaves, so that only the balance constraint can reject the witness.
7. THE `over_limit_unflagged_fails` test SHALL use a witness in which exactly one Real_Slot has `amount` equal to `limit_cents` + 1 with `review_flag` not set, the debit and credit sums are equal, every amount is below 2^40, every other Real_Slot satisfies the limit-or-flag constraint, and the public `merkle_root` equals the root of the supplied Leaves, so that only the limit-or-flag constraint can reject the witness.
8. THE `amount_at_2_pow_40_fails` test SHALL use a witness in which one slot has `amount` equal to exactly 2^40 (1,099,511,627,776) with `review_flag` set, the debit and credit sums are equal, and the public `merkle_root` equals the root of the supplied Leaves, so that only the range check can reject the witness.
9. THE `nonzero_padding_fails` test SHALL use a witness with `record_count` below 64 in which one Padding_Slot holds `amount` of at least 1 cent and below 2^40, the debit and credit sums are equal, and the public `merkle_root` equals the root of the supplied Leaves, so that only the padding constraint can reject the witness.
10. THE `wrong_root_fails` test SHALL use an otherwise Valid_Witness whose public `merkle_root` equals the root of the supplied Leaves plus 1, modulo the field, so that only the root constraint can reject the witness.
11. THE `record_count_64_passes` test SHALL use a Valid_Witness with `record_count` equal to 64, 64 Real_Slots and no Padding_Slots.
12. THE `record_count_0_fails` test SHALL use a witness with `record_count` equal to 0 in which all 64 slots hold the Padding_Posting, the debit and credit sums are equal, and the public `merkle_root` equals the root of the supplied Leaves, so that only the `record_count` lower bound can reject the witness.
13. THE `valid_batch_passes` test SHALL use a Valid_Witness with `record_count` between 1 and 63, at least one Padding_Slot, equal debit and credit sums, every Real_Slot at or below `limit_cents`, and a public `merkle_root` equal to the root of the supplied Leaves.
14. THE `over_limit_flagged_passes` test SHALL use a Valid_Witness in which at least one Real_Slot has `amount` above `limit_cents` with `review_flag` set, and every other constraint holds.
15. THE `amount_2_pow_40_minus_1_passes` test SHALL use a Valid_Witness in which one slot has `amount` equal to exactly 2^40 - 1 (1,099,511,627,775), the debit and credit sums are equal, `review_flag` is set on that slot (or `limit_cents` equals 2^40 - 1), and the public `merkle_root` equals the root of the supplied Leaves, so that the test shows the upper bound of the amount range check is inclusive.
16. THE `amount_equal_limit_unflagged_passes` test SHALL use a Valid_Witness in which one Real_Slot has `amount` equal to `limit_cents` with `review_flag` not set, and every other constraint holds.
17. THE `record_count_65_fails` test SHALL use a balanced witness with `record_count` equal to 65 in which the public `merkle_root` equals the root of the supplied Leaves, so that only the `record_count` upper bound can reject the witness.
18. THE `limit_at_2_pow_40_fails` test SHALL use an otherwise valid witness with `limit_cents` equal to exactly 2^40 (1,099,511,627,776) in which the public `merkle_root` equals the root of the supplied Leaves, so that only the `limit_cents` range check can reject the witness.
19. IF any of the eight `_fails` tests passes in the run described in criterion 3, THEN THE Spike_Team SHALL correct that test so that it fails against the skeleton and SHALL repeat the run before adding any constraint.

### Requirement 6: Property-based tests for parity and constraints

**User Story:** As a maintainer, I want randomised tests of the circuit and the TypeScript witness builder, so that edge cases beyond the named circuit examples are covered without paying for a full proof on every run.

#### Acceptance Criteria

1. THE test suite SHALL place the circuit property tests under `tests/zk/` with the suffix `.prop.test.ts`, and shared arbitraries under `tests/support/`.
2. FOR ALL random Valid_Witness values with `record_count` in 1..64, THE witness execution through `noir_js`, without proof generation, SHALL return a witness without throwing, with at least 100 runs per property, where the Valid_Witness values come from a fast-check arbitrary with `record_count` in 1..64, balanced Real_Slots, and Padding_Slots holding the Padding_Posting.
3. FOR ALL Valid_Witness values, with each run drawing one random slot index from 0 to 63 and one direction (+1 or -1 cent), THE witness execution SHALL throw after the amount of that one slot is changed by one cent in that direction and the witness is applied with the original public `merkle_root`, with 100 runs in total, each run changing exactly one slot in exactly one direction. The draws SHALL be constrained so that the new amount stays within 0 to 2^40 - 1, so that every one of the 100 runs applies a change and no run is skipped.
4. FOR ALL amounts drawn from 2^40 to 2^64 - 1, from 2^53 - 2 to 2^53 + 2, and from the field modulus minus 2 to the field modulus plus 2, THE Witness_Builder SHALL throw an error indicating that the amount is out of range before it builds any Circuit input, with at least 100 runs in total.
5. FOR ALL random Valid_Witness values, a proof generated by `bb.js` SHALL verify with the verification returning true, with exactly 3 runs. The test timeout SHALL be at least 3 times the sum of the measured proof generation time and verification time of one run, multiplied by 3 runs.
6. FOR ALL random Valid_Witness values used in the proof property, THE verification SHALL return false or throw for each of three variants of the proof, with exactly 3 runs. In each variant exactly one public input (`merkle_root`, `record_count` or `limit_cents`) is changed to a different value and the other two keep their original values.
7. THE test suite SHALL set a fixed integer seed in the source of every property and SHALL print that seed in the test output of every run, together with the shrunk counterexample when a property fails.
8. WHEN a property finds a defect in the Circuit or the Witness_Builder, THE Spike_Team SHALL add a regression example test that reproduces the counterexample and SHALL append an entry to `tests/PBT-LOG.md` stating the date, the property name, the seed, the shrunk counterexample, the root cause and the fix.

### Requirement 7: Compiled artifact and build script

**User Story:** As a deployer, I want the compiled circuit committed with a checksum, so that the Netlify build does not need `nargo`.

#### Acceptance Criteria

1. THE Build_Script SHALL live at `scripts/build-circuit`.
2. WHEN the Build_Script runs, THE Build_Script SHALL run `nargo compile` for `circuits/ledger_audit` and copy the compiled JSON to `src/zk/artifacts/ledger_audit.json`. The Artifact is the compiled JSON with absolute source paths in file_map rewritten to package-relative paths; bytecode and abi are copied unchanged.
3. WHEN the Build_Script has written the Artifact, THE Build_Script SHALL write `src/zk/artifacts/ledger_audit.meta.json` and exit with status 0. The Artifact_Meta SHALL contain exactly two values: the `nargo` version string and the sha256 of the Artifact. The version string is the first line of the `nargo --version` output with trailing whitespace removed. The sha256 is 64 lowercase hexadecimal characters. The Artifact_Meta SHALL contain no timestamp, path or other value that changes between runs on an unchanged Circuit.
4. IF `nargo` is not installed, `nargo compile` exits with a nonzero status, or the compiled JSON file is missing after compilation, THEN THE Build_Script SHALL exit with a nonzero status and print an error message to standard error that names the failed step. THE Build_Script SHALL leave the existing Artifact and Artifact_Meta byte-identical to their contents before the run, and SHALL NOT leave a partially written file at either path.
5. WHEN the Build_Script runs twice in a row with the same `nargo` version and unchanged files under `circuits/ledger_audit`, THE Build_Script SHALL produce a byte-identical Artifact and a byte-identical Artifact_Meta on both runs (idempotence).
6. THE repository SHALL track the Artifact and Artifact_Meta in version control, so that `git ls-files` lists both paths, and `git check-ignore` SHALL report `circuits/ledger_audit/target/` as ignored.
7. THE Spike_Page build SHALL read only the committed Artifact. The build SHALL complete with exit status 0 when `nargo` is absent from `PATH`.
8. THE test suite SHALL include a test that recomputes the sha256 of the Artifact and fails when it differs from the sha256 value in Artifact_Meta, or when Artifact_Meta is missing or does not contain a 64-character lowercase hexadecimal sha256.
9. THE test suite SHALL include a test that fails when the semantic version in the Artifact_Meta `nargo` version string is not exactly `1.0.0`, including any pre-release or build suffix, or when the version string is missing.

### Requirement 8: Spike page and worker with timings

**User Story:** As the project owner, I want a page that proves and verifies the real circuit in a worker and prints stage timings, so that I can read the gate numbers directly.

#### Acceptance Criteria

1. THE Spike_Page SHALL consist of `spike.html` and `src/zk/spike.ts`, and SHALL run all `noir_js` and `bb.js` work inside the Spike_Worker, so that no `noir_js` or `bb.js` call executes on the page's main thread.
2. WHEN a user presses the run control on the Spike_Page while no run is in progress, THE Spike_Worker SHALL run these five stages in this order, each starting only after the previous one has finished: WASM INIT (download and initialise WASM), WITNESS PREP (compute Leaves and the Merkle_Root with `bb.js` hashing), EXECUTE (execute the Circuit with the Spike_Witness), PROVE (generate an UltraHonk proof with `threads: 1`), and VERIFY (verify the proof).
3. THE Spike_Witness SHALL contain 64 Postings with `record_count` equal to 64, every amount below 2^40 and a public `merkle_root` computed with `bb.js` hashing, so that the EXECUTE stage completes without error.
4. THE Spike_Witness SHALL be committed to the repository and SHALL be marked as synthetic, with a "SYNTHETIC DEMO DATA" label in its source file.
5. WHEN a run finishes with a verification result of true, THE Spike_Page SHALL display one timing per stage, labelled WASM INIT, WITNESS PREP, EXECUTE, PROVE and VERIFY, plus one timing labelled TOTAL. Each timing SHALL be a whole number of milliseconds, and TOTAL SHALL be greater than or equal to the sum of the five stage timings.
6. THE TOTAL timing SHALL be measured on one clock, from immediately before the Spike_Worker is created until the Spike_Page receives the verification result, so that it includes worker start-up, WASM download, initialisation and all five stages.
7. WHEN a run finishes with a verification result of true, THE Spike_Page SHALL display the proof size as a whole number of bytes.
8. WHEN a run finishes, THE Spike_Page SHALL display the value of `crossOriginIsolated` as true or false, separately for the Spike_Worker and for the Spike_Page, each with its own label.
9. IF verification returns false, a stage throws, or the Spike_Worker raises an uncaught error, THEN THE Spike_Page SHALL display a FAILED result that names the stage that was running (WASM INIT, WITNESS PREP, EXECUTE, PROVE or VERIFY), SHALL keep displaying the timings of the stages that completed before the failure, and SHALL NOT display a success result, a TOTAL timing or a proof size.
10. WHILE a run is in progress, THE Spike_Page SHALL display the name of the current stage, and SHALL update it within 250 ms after each stage starts.
11. THE Spike_Worker SHALL load the WASM files, the Artifact and the SRS_Files only from the origin that serves the Spike_Page.
12. THE Spike_Worker SHALL start `bb.js` with `threads: 1`, and a run SHALL complete on a page that is served without COOP and COEP headers and reports `crossOriginIsolated` as false.
13. THE Spike_Page SHALL render every visible label, status and error text in uppercase letters, and each status or error text SHALL be at most 10 words and SHALL name the stage or invariant involved, following the voice rules in `product.md`.
14. WHILE a run is in progress, THE Spike_Page SHALL disable the run control, so that a second press starts no second run and creates no second Spike_Worker.
15. WHEN a run finishes with a verification result of true, THE Spike_Page SHALL display a success result and SHALL NOT display a FAILED result.
16. THE Spike_Page SHALL display a visible "DEMO DATA" label while it is shown, in line with the demo-labelling rule in `product.md`.

### Requirement 9: Invalid-witness behaviour report

**User Story:** As a UI author, I want to know exactly what `noir.execute` does with a failing constraint, so that the later terminal copy can map errors to named invariants.

#### Acceptance Criteria

1. WHEN a user presses the invalid-witness control on the Spike_Page, THE Spike_Worker SHALL run `noir.execute` exactly once with a copy of the Spike_Witness in which the amount of the first Real_Slot (index 0) is increased by exactly 1 cent, so that the sum of debit amounts and the sum of credit amounts differ by exactly 1 cent. The modified amount SHALL stay below 2^40, and the modified posting SHALL still satisfy `amount <= limit_cents` or have `review_flag` set. The Leaves and the Merkle_Root SHALL be recomputed from the modified postings, so that only the balance constraint can reject the witness. The committed Spike_Witness SHALL remain unchanged, and a later valid run SHALL use the original Spike_Witness.
2. WHEN the invalid-witness run finishes, THE Spike_Page SHALL display the following values as text:
   - whether `noir.execute` threw (YES or NO);
   - whether it returned a witness (YES or NO);
   - the error constructor name;
   - the own property names of the error object, as a list;
   - the full error message text.

   IF `noir.execute` did not throw, THEN THE Spike_Page SHALL display NOT APPLICABLE in place of the three error fields. IF the thrown value is not an object, THEN THE Spike_Page SHALL display its `typeof` result in place of the constructor name and property names.
3. IF `noir.execute` returns a witness for the invalid inputs, THEN THE Spike_Worker SHALL attempt proof generation once with that witness and `threads: 1`. THE Spike_Page SHALL display whether proof generation threw (YES or NO) and, if it threw, the error constructor name, the own property names and the error message text. IF proof generation returns a proof, THEN THE Spike_Worker SHALL verify it, and THE Spike_Page SHALL display the verification result (TRUE or FALSE).
4. WHEN the invalid-witness run finishes, THE Spike_Page SHALL display YES or NO for whether the error message text, or any string value of an own property of the error object, contains a private input value. The check SHALL compare against the decimal form and the `0x`-prefixed hexadecimal form of the `amount`, `salt`, `account` and `record_id` of every posting in the modified witness. A value matches only as a whole token, delimited by characters other than letters and digits. IF the result is YES, THEN THE Spike_Page SHALL also display which of the four field names matched.
5. WHEN the invalid-witness run has finished and its displayed values are copied into the Results_Document, THE Spike_Team SHALL replace the "Unverified" bullet in the "API as looked up" section of Noir_Notes with the observed behaviour (threw or returned a witness) and the error shape (constructor name, own property names, and whether the message contains private values).
6. IF the observed behaviour differs from the behaviour that Noir_Notes assumed, THEN THE Spike_Team SHALL append a quirks log entry to Noir_Notes. The entry SHALL carry the date in `YYYY-MM-DD` form, the assumed behaviour, the observed behaviour, and the `noir_js` and `bb.js` versions.
7. THE Spike_Page SHALL display error shape details as page text and SHALL NOT write them to `console.*`.
8. IF the Spike_Worker fails before `noir.execute` is called, or the invalid-witness run does not finish within 120 seconds, THEN THE Spike_Page SHALL display a FAILED result naming the failing stage (or TIMEOUT for the 120-second case) and SHALL NOT display the behaviour report values from criteria 2 to 4. THE Spike_Page SHALL remain usable, so that the user can press the invalid-witness control or the run control again.

### Requirement 10: Data protection in the spike

**User Story:** As a security reviewer, I want the spike to follow the repository security rules even though its data is synthetic, so that the pattern carries into the real app.

#### Acceptance Criteria

1. THE Spike_Page and Spike_Worker SHALL NOT include any Posting field, Leaf, Merkle_Root, Limit or salt in the URL, query string, headers, body or message of any network request, whether made through `fetch`, XHR, WebSocket, `sendBeacon`, `EventSource`, image pings, form posts, or the URL of a worker script.
2. THE Spike_Page and Spike_Worker SHALL request only same-origin static assets (the page, the Spike_Worker script, WASM files, the Artifact and the SRS_Files), and every such request SHALL carry no request body.
3. THE Spike_Page and Spike_Worker SHALL NOT import or call any analytics, telemetry or error-reporting library or endpoint, and SHALL NOT register a global error handler that transmits data off the page.
4. THE Spike_Page and Spike_Worker SHALL write to `console.*` only record counts, stage names and timings in milliseconds, and SHALL NOT write any Posting field, Leaf, Merkle_Root, Limit or salt to `console.*`, `localStorage`, `sessionStorage`, IndexedDB, cookies or the Cache API.
5. THE repository SHALL contain, in files added or changed by this spec, no private key material, no function that creates a signature, and no import of a signing library.
6. THE Spike_Witness SHALL use synthetic values only, and SHALL contain no real account number, PAN or customer data.
7. WHEN the Spike_Deploy completes, THE Spike_Team SHALL write the steps for the Chrome network-panel review of a Cold_Run into the Results_Document under a section titled "Browser steps for huynh", covering what to open, what to count, and what to record (the number of requests, whether every request was same-origin, and whether any request carried a body), with the result cells left blank for huynh to fill in, and SHALL NOT perform the network-panel review itself.

### Requirement 11: Spike isolation from the final build

**User Story:** As the project owner, I want the temporary spike page kept out of the shipped app, so that the final build contains only the real UI.

#### Acceptance Criteria

1. WHEN the default `npm run build` runs, THE Build_System SHALL exit with status 0 and produce `dist/` in which no file path contains the string `spike` (case-insensitive) and no file's text contains the string `SYNTHETIC DEMO DATA`, so that `spike.html`, the Spike_Worker bundle, the Spike_Witness and any other bundle derived from `src/zk/spike.ts` are absent.
2. WHEN the spike build is selected through a named script or Vite mode, THE Build_System SHALL exit with status 0 and produce `dist/` that uses `spike.html` as its only HTML input, so that `dist/` contains `spike.html` and no `index.html`, together with the Spike_Worker bundle, the Artifact, the SRS_Files (the `.dat` files), and the WASM files that `noir_js` and `bb.js` load at run time.
3. THE Results_Document SHALL list, by repository-relative path, every file that exists only for the spike, and SHALL give an ordered list of removal steps. The steps SHALL cover deleting those files, deleting the named spike script or Vite mode entry, and re-running the default build and the test suite. After the steps, no tracked file other than the Results_Document SHALL contain the strings `spike.html` or `src/zk/spike.ts`. The SRS_Files and their sha256 test (Requirement 14.6) are not spike-only and SHALL NOT appear in the list or in the removal steps.
4. THE default build and the spike build SHALL each keep `build.target: 'esnext'` in `vite.config.ts`, because `bb.js` uses top-level await.

### Requirement 12: Non-production Netlify deploy

**User Story:** As the project owner, I want a deployed URL for the spike, so that I can measure the gate numbers under real hosting conditions.

#### Acceptance Criteria

1. WHEN the Spike_Team is about to create the Spike_Deploy, THE Spike_Team SHALL run `netlify status` and SHALL report the site name and account name from its output to huynh, and SHALL NOT create the Spike_Deploy until huynh has confirmed the site and account in reply.
2. IF `netlify status` shows a different site or account than the one huynh confirmed, or shows no linked site or account, THEN THE Spike_Team SHALL stop, SHALL create no deploy, and SHALL ask huynh which site and account to use.
3. WHEN huynh has confirmed the site and account, THE Spike_Team SHALL create the Spike_Deploy as a non-production deploy through the Netlify power, and SHALL NOT run a production deploy unless huynh asks for one in writing.
4. THE Spike_Deploy SHALL publish only the contents of a `dist/` directory produced by the spike build selected under Requirement 11.2.
5. IF `dist/` contains any file other than `spike.html`, the bundles derived from `src/zk/spike.ts`, the Artifact, `_redirects`, the SRS `.dat` files (the g1 prefix and the g2 file), and WASM and JavaScript assets that the spike build references, THEN THE Spike_Team SHALL stop, SHALL list the unexpected files to huynh, and SHALL NOT deploy until huynh confirms. `spike.html` SHALL be the only HTML file allowed in the published `dist/`, and an `index.html` or any other HTML file SHALL count as an unexpected file.
6. THE Spike_Deploy SHALL NOT include a `_headers` file, SHALL NOT configure a `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` header in `netlify.toml`, and `public/_headers` SHALL NOT be created by this spec.
7. WHEN the Spike_Deploy completes, THE Spike_Team SHALL write the smoke-run steps into the Results_Document under the section titled "Browser steps for huynh" (open the deployed URL, wait up to 10 s for the run control, press the run control once, and confirm that the finished run reports `crossOriginIsolated` as false on the page and in the Spike_Worker), with the confirmation cell left blank for huynh, and SHALL NOT open the deployed page, press the run control or review the network panel itself.
8. IF huynh reports that the deployed Spike_Page shows no run control within 10 s, shows a FAILED result, or shows no result within 120 s of pressing the run control, THEN THE Spike_Team SHALL record the failing stage, the displayed error text and the Spike_Deploy URL, as reported by huynh, in the Results_Document, SHALL report back to huynh, and SHALL NOT mark the deploy as ready for measurement.
9. IF the deploy command fails or returns no deploy URL, THEN THE Spike_Team SHALL stop, SHALL report the command output to huynh, and SHALL NOT retry the deploy as a production deploy.
10. WHEN the Spike_Deploy completes, THE Spike_Team SHALL record the deploy URL and the deploy date in the Results_Document.
11. THE Spike_Team SHALL NOT install or run any browser automation tool for this spec, including Playwright browsers, a browser MCP server and a headless browser.

### Requirement 13: Spike results document and gate decision

**User Story:** As the project owner, I want a results document with a fill-in table, so that I can record the measured numbers and decide between the current design and option B.

#### Acceptance Criteria

1. THE Results_Document SHALL live at `docs/spike-results.md`.
2. THE Results_Document SHALL state the Spike_Deploy URL, the deploy date in `YYYY-MM-DD` format, and the installed version string of each of `nargo`, `@noir-lang/noir_js`, `@noir-lang/acvm_js`, `@noir-lang/noirc_abi`, `@noir-lang/types`, `@aztec-foundation/bb.js`, Vite and Node, taken from the output of `nargo --version`, `npm ls` and `node --version`.
3. THE Results_Document SHALL contain one table with exactly two data rows, one for the Normal_Gate and one for the Throttled_Gate. The table SHALL have these columns: target, Cold_Run total in milliseconds, one column for each of the five per-stage timings in milliseconds defined in Requirement 8.5 (WASM INIT, WITNESS PREP, EXECUTE, PROVE, VERIFY), proof size in bytes, Chrome version, machine description, and pass or fail.
4. THE Normal_Gate row SHALL state the target "under 30 s" and the Throttled_Gate row SHALL state the target "under 60 s with Chrome DevTools 4x CPU throttling".
5. THE Results_Document SHALL describe the Cold_Run procedure as these steps, in order: open Chrome on huynh's Mac, open DevTools and enable "Disable cache" in the Network panel, set CPU throttling to "No throttling" for the Normal_Gate or "4x slowdown" for the Throttled_Gate, load the Spike_Deploy URL for the first time, press the run control once, and read the timings from the Spike_Page. The Results_Document SHALL state that `bb.js` runs with `threads: 1` and that one Cold_Run supplies the numbers for each gate.
6. THE Results_Document SHALL state that a gate passes only if its Cold_Run total is strictly below its target, and that failing either gate means switching to Option_B, which is Circom with snarkjs.
7. THE Results_Document SHALL contain these five sections, each with a heading: "Tests written first" (the full `nargo test` output from Requirement 5.4), "Lookups" (from Requirement 1.10), "Invalid-witness report" (a summary of the Requirement 9.2 to 9.4 findings), "Spike-only files" (the list from Requirement 11.3) and "Browser steps for huynh" (the steps from Requirement 10.7 and Requirement 12.7).
8. THE Spike_Team SHALL leave every measured cell and every pass or fail cell in the gate table, and every result cell in the "Browser steps for huynh" section, empty, with no placeholder value, estimate or example number.
9. WHEN the Results_Document is complete, THE Spike_Team SHALL report its path to huynh, SHALL make no pass or fail judgement, SHALL start no further spike tasks, and SHALL wait for huynh to fill in the measurements.

### Requirement 14: SRS files for in-browser proving

**User Story:** As the project owner, I want the SRS served from the app's own origin and proven byte-identical to the published ceremony files, so that proving needs no third-party request and the SRS is demonstrably the published data.

#### Acceptance Criteria

1. THE SRS_Files SHALL live under `src/zk/artifacts/srs/` and SHALL be tracked in version control, so that `git ls-files` lists every SRS_Files path.
2. WHEN the Artifact exists, THE Spike_Team SHALL derive the required point count from the compiled Circuit, using the circuit size (the gate count of `ledger_audit` including lookup tables) as reported by `bb.js` or the `bb` CLI by the method confirmed by a lookup, and SHALL choose the committed point count as the smallest power of two that is not smaller than the required point count. IF 2^16 is smaller than the required point count, THEN THE Spike_Team SHALL commit the smallest power of two that fits, and the committed point count SHALL NOT be 2^16.
3. WHEN the point count is chosen, THE Spike_Team SHALL record in Noir_Notes the measured circuit size, the required point count and the chosen point count.
4. THE committed g1 prefix file and the committed g2 file SHALL each be byte-identical to the corresponding byte range of the published Aztec ceremony file of the same kind.
5. WHEN the SRS_Files are committed, THE Spike_Team SHALL record in Noir_Notes, for each committed SRS file, the source URL, the byte range taken from the source file, and the sha256 as a lowercase 64-character hexadecimal string.
6. THE test suite SHALL include a test that recomputes the sha256 of each committed SRS file and fails when either value differs from the expected value stored in a committed file, or when that file or an SRS file is missing, and the expected values stored in that file SHALL equal the values recorded in Noir_Notes under criterion 5. The storage location of the expected values is a design decision.
7. WHEN the Spike_Worker proves, THE Spike_Worker SHALL load the SRS_Files only from the origin that serves the Spike_Page, and a Cold_Run SHALL make no request to any other origin, including the host of the ceremony files.
8. IF proof generation needs more SRS points than the committed prefix holds, THEN THE Spike_Page SHALL display a FAILED result that names the PROVE stage and an SRS size message that follows Requirement 8.13, and THE Spike_Team SHALL treat the chosen point count as too small and repeat criterion 2.
9. THE Results_Document SHALL NOT list the SRS_Files among the spike-only files, and the removal steps for the spike SHALL leave the SRS_Files and the test from criterion 6 in place.

## Requirement Traceability

| Requirement | Covering test or check |
|-------------|------------------------|
| 1 | Command output and lookups recorded in the Results_Document; `npm ls` and `package.json` review |
| 2, 4 | `nargo test` cases (Requirement 5); one-cent and proof-tamper properties (6.3, 6.6) |
| 3 | Root parity property (3.8, 6.2); known-answer vectors (3.11); `nargo test` `valid_batch_passes` |
| 5 | `nargo test` run before (eight `_fails` tests failing, five `_passes` tests passing against the constraint-free skeleton) and after the constraints exist (all thirteen tests passing) |
| 6 | `tests/zk/*.prop.test.ts` with fixed seeds |
| 7 | Artifact checksum test (7.8), nargo version test (7.9), idempotence check (7.5); the failure behaviour in 7.4 is verified by review of the Build_Script, with the automated test with `nargo` absent deferred to zk-core |
| 8, 9 | Manual run on the Spike_Deploy by huynh; results recorded in the Results_Document |
| 10 | Review of the spike source (10.1 to 10.6); network-panel review performed by huynh from the "Browser steps for huynh" section (10.7); the automatic source scan is deferred to zk-core |
| 11 | Inspection of `dist/` after both builds (11.1, 11.2), review of the Results_Document (11.3) and of `vite.config.ts` (11.4); the automated default-build and `build.target` checks are deferred to zk-core |
| 12, 13 | Manual deploy check, steps performed by huynh from the "Browser steps for huynh" section, and Results_Document review |
| 14 | SRS sha256 test (14.6); point count, source URL, byte range and sha256 values recorded in Noir_Notes (14.3, 14.5); network-panel review by huynh for same-origin loading (14.7); review of the Results_Document spike-only list (14.9) |

## Open Questions for the Design Phase

1. Does `@aztec-foundation/bb.js` 6.0.0 expose a Poseidon2 hash for JavaScript, and what are its exact export, input encoding and output type? Does it match `std::hash::poseidon2` in Noir 1.0.0, with the same parameters? Resolve by lookup and a parity experiment. Requirement 3.2 and 3.3 depend on the answer.
2. Which Noir integer types hold `amount`, `limit_cents`, `record_count` and `side` or `review_flag`, and can an amount of at least 2^40 be encoded into the ABI at all? The circuit test `amount_at_2_pow_40_fails` (Requirement 5.8) and Requirement 4.2 depend on the answer.
3. How are `record_id` and `account` encoded as field elements (for example, as integers or as packed bytes)? This stays inside the spike because the next spec must compute the same Leaves.
4. How does the Padding_Posting encode side and review flag, and does the Padding_Posting carry a fixed salt?
5. Does `noir.execute` throw on a failed constraint, and does the thrown error expose the failing constraint or the input values? Requirement 9 settles this by experiment.
6. Do `noir_js` 1.0.0 and `bb.js` 6.0.0 work together in Node (for Vitest) and in the browser worker? Which Vite configuration does the worker need for WASM handling, and does `acvm_js` and `noirc_abi` WASM need explicit initialisation with URLs? How is `bb.js` 6.0.0 given a same-origin SRS (g1 prefix and g2) instead of downloading it, and which API or option does that (Requirement 14.7)?
7. Does `npm run build` on Netlify, or a CLI `netlify deploy` of a locally built `dist/`, carry the spike build? Which script or Vite mode selects the spike build, so that Requirement 11 and Requirement 12 hold together?
8. Does the Build_Script use Node or shell, and how does the Build_Script produce a stable `nargo` version string for the Artifact_Meta (for example, the first line of `nargo --version`)?
9. How long does one proof take in Node under Vitest, and what timeout and `numRuns` follow from it for the proof properties in Requirement 6.5 and 6.6?
10. What are the exact file format and byte layout of the Aztec ceremony g1 and g2 files, which URL serves them, and is a byte range of the g1 file a valid prefix for `bb.js` 6.0.0? Resolve by lookup in the design phase, with no assumption. Requirement 14.2, 14.4 and 14.5 depend on the answer.
