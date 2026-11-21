# Requirements Document

## Introduction

`ledger-format` is the simulated core ledger for CryptTerm. It defines a fixed-width, COBOL-batch-style batch file (header record, one posting per line, trailer record), a parser and serializer, a seeded batch generator, an Ed25519 signed digest over `(batch_id, merkle_root, record_count)`, a build-time script that writes signed samples, and browser-side digest verification.

The spec reuses the spike code with one approved change: `src/zk/posting.ts` and `src/zk/field.ts` move to `src/ledger/posting.ts` and `src/ledger/field.ts` (`git mv`; contents byte-identical apart from comments that name their own path; neither file has imports). They move because `src/zk` may import only `src/ledger`, so a later `toWitness(batch: Batch)` in `src/zk` can import `Batch` from `src/ledger`, and `Batch` needs `Posting` and the bounds. The other `src/zk` files and the tests that import the two moved files change their import paths and nothing else. `hash.ts`, `merkle.ts` and `witness-builder.ts` stay in place and unchanged apart from import paths, and the circuit and the Artifact stay unchanged. The `Posting` type, `PADDING_POSTING`, `leafInputs`, the constants `CAPACITY`, `AMOUNT_BOUND_CENTS`, `ID_MAX`, `SALT_BOUND` and `FIELD_MODULUS`, the `Hasher`, `merkleRoot` and `buildCircuitInputs` are reused as they are. If anything else must change, work stops and huynh is asked.

Column layout, domain tag and digest byte layout are decided in `design.md`. Terminal-style uppercase error copy belongs to the UI spec, not here. Every property test uses fast-check with at least 200 runs. No property calls the `Hasher`. The `Hasher` runs only in the example tests `samples_verify_and_roots` and `samples_reproducible`.

## Glossary

- **Batch_File**: The text format. LF-terminated ASCII lines of fixed width: one header (batch id), 1 to 64 posting lines, one trailer (batch id, posting count).
- **Batch_Codec**: `parseBatch`, `serializeBatch` and `BatchFormatError` in `src/ledger`.
- **Invariant_Checker**: A pure function in `src/ledger` that reports, for a `Batch`, whether it balances, whether every posting is within `LIMIT_CENTS` (1,000,000 cents) or flagged Y, and whether every field is in range.
- **Batch_Generator**: `generateBatch` in `src/ledger`.
- **Root_Function**: `batchRoot` in `src/zk/batch-root.ts`, which returns the Merkle root of a `Batch` through the existing `Hasher`, `buildCircuitInputs` and `merkleRoot`.
- **Digest_Module**: `digestMessage`, `SignedDigest`, `verifyDigest` and `TRUSTED_SOURCE_KEYS`, in `src/ledger`. It takes `FIELD_MODULUS` from `src/ledger/field.ts`.
- **Module_Layout**: The placement of source files and the import direction between `src/ledger`, `src/zk` and `src/ui`.
- **Sample_Writer**: `scripts/gen-samples.ts`, the only code that signs.
- **Demo_Key**: The Ed25519 demo core-ledger key in `scripts/demo-key/DEMO_ONLY_core_ledger_key.json`. It is public by design.

## Requirements

### Requirement 1: Parse batch files

**User Story:** As the terminal app, I want to parse a batch file into a `Batch`, so that postings can be shown and hashed.

#### Acceptance Criteria

1. THE Batch_File SHALL consist of one header line, 1 to 64 posting lines in slot order, and one trailer line, with the column layout defined in one place in `src/ledger` (test: `roundtrip`, `text_roundtrip`)
2. WHEN valid Batch_File text is given, THE Batch_Codec SHALL return a `Batch` whose `postings` are `Posting` values in line order, with side D as `0n`, C as `1n`, flag N as `0n` and flag Y as `1n` (test: `roundtrip`)
3. IF the text has a wrong line width, a non-digit character in the amount, an amount of 2^40 or more, a trailer count different from the number of posting lines, a trailer batch id different from the header batch id, a side other than D or C, a flag other than Y or N, more than 64 postings, zero postings, a missing header or a missing trailer, THEN THE Batch_Codec SHALL throw a `BatchFormatError` holding the 1-based line number of the defect and a reason code that differs for each defect (test: `parser_rejects_malformed`)
4. THE `BatchFormatError` message and properties SHALL contain only the line number and the reason code, and no field value (test: `parser_rejects_malformed`, which plants sentinel digits in the rejected line and asserts they are absent from the error)
5. THE Batch_Codec SHALL accept only the canonical text of a batch, so that CRLF line ends and lowercase side or flag letters are rejected (test: `parser_rejects_malformed`)

### Requirement 2: Serialize and round-trip

**User Story:** As a developer, I want serialization to invert parsing exactly, so that a batch file and its in-memory form never drift apart.

#### Acceptance Criteria

1. WHEN a valid `Batch` is given, THE Batch_Codec SHALL return its Batch_File text through `serializeBatch` (test: `roundtrip`)
2. FOR ALL valid `Batch` values `b`, `parseBatch(serializeBatch(b))` SHALL deep-equal `b` (test: `roundtrip`)
3. FOR ALL valid Batch_File text `t`, `serializeBatch(parseBatch(t))` SHALL equal `t`, where `t` is built field by field from the column layout and not through `serializeBatch` (test: `text_roundtrip`)
4. IF `serializeBatch` receives a `Batch` with zero postings, more than 64 postings, a non-conforming `batchId` or an out-of-range field, THEN THE Batch_Codec SHALL throw an error that holds a fixed reason code and no field value (test: `field_range_rejected`)

### Requirement 3: Amounts and field values

**User Story:** As a security reviewer, I want amounts handled as bigint cents with strict ranges, so that no float or wrapped value reaches the hasher.

#### Acceptance Criteria

1. THE Batch_Codec SHALL read each amount from digit-only text into a `bigint`, rejecting signs, decimal points, exponents and whitespace (test: `parser_rejects_malformed`)
2. IF a parsed amount is 2^40 or more, or a `recordId` or `account` is above `ID_MAX`, or a `salt` is `SALT_BOUND` or more, THEN THE Batch_Codec SHALL throw a `BatchFormatError` with the line number and a range reason code (test: `field_range_rejected`)
3. FOR ALL amounts drawn from boundary values (2^40 - 1, 2^40, 2^40 + 1, values within 4 of 2^53, values within 4 of `FIELD_MODULUS`, negatives), THE Batch_Codec SHALL accept 2^40 - 1 and reject every other value in both `parseBatch` and `serializeBatch`, without wrapping (test: `field_range_rejected`)
4. THE `src/ledger` sources SHALL take the bounds from `src/ledger/field.ts` and SHALL contain no `parseFloat`, no `parseInt`, no `console.*`, no network API name (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`) and no literal copy of 2^40 (test: `ledger_static_scan`, example)
5. THE Module_Layout SHALL place `posting.ts` and `field.ts` in `src/ledger/`, SHALL contain no file `src/zk/posting.ts` or `src/zk/field.ts`, SHALL have `src/ledger` import nothing from `src/zk` or `src/ui`, and SHALL have `src/zk` import the two files from `src/ledger` (test: `ledger_static_scan`, example)

### Requirement 4: Invariant checker and seeded generator

**User Story:** As a demo author, I want deterministic batches that are clean or break exactly one invariant, so that the prover and verifier demos behave the same on every run.

#### Acceptance Criteria

1. WHEN a `Batch` is given, THE Invariant_Checker SHALL report three independent results: debit sum equals credit sum, every amount at most `LIMIT_CENTS` or flagged Y, and every field in range (test: `clean_batches_satisfy_invariants`, `violating_kinds_break_exactly_one_invariant`)
2. FOR ALL equal `opts`, THE Batch_Generator SHALL return deep-equal batches, using only the seed as input and no `Math.random`, clock or platform randomness (test: `generator_deterministic`)
3. WHEN `kind` is `clean`, THE Batch_Generator SHALL return a batch for which all three invariant results hold, and MAY include over-limit postings that carry flag Y (test: `clean_batches_satisfy_invariants`)
4. WHEN `kind` is `overLimitUnflagged`, THE Batch_Generator SHALL return a batch for which only the limit-or-flag result fails (test: `violating_kinds_break_exactly_one_invariant`)
5. WHEN `kind` is `unbalanced`, THE Batch_Generator SHALL return a batch for which only the balance result fails (test: `violating_kinds_break_exactly_one_invariant`)
6. WHEN `kind` is `large`, THE Batch_Generator SHALL return a clean batch of exactly 64 postings (test: `clean_batches_satisfy_invariants`)
7. IF `seed` is not a non-negative safe integer, or `count` is outside 2 to 64, or `kind` is `large` and `count` is not 64, THEN THE Batch_Generator SHALL throw an error with a fixed message (test: `generator_deterministic`)
8. THE Batch_Generator SHALL derive every salt from the seed within `0 <= salt < SALT_BOUND`, and the generator source and `scripts/demo-key/README.md` SHALL state that seeded salts are for demo determinism and are not random (test: `generator_deterministic` for the range, `ledger_static_scan` for the statement)

### Requirement 5: Merkle root of a batch

**User Story:** As the signer and the verifier, I want one root computation shared with the prover, so that the signed root equals the root the circuit binds.

#### Acceptance Criteria

1. THE Root_Function SHALL live in `src/zk/batch-root.ts`, SHALL take the `Hasher` as a parameter, and SHALL import `Batch` and `Posting` from `src/ledger` (test: `ledger_static_scan`, example)
2. WHEN a `Batch` is given, THE Root_Function SHALL return the same root that `buildCircuitInputs` returns for the same postings, padded to 64 slots with `PADDING_POSTING` (test: `samples_verify_and_roots`, example)
3. THE Root_Function SHALL reuse `buildCircuitInputs`, `merkleRoot` and the padding of the existing code, and SHALL contain no hash, padding or leaf-encoding logic of its own (test: `ledger_static_scan`, which scans `src/zk/batch-root.ts` for `hashLeaf`, `hashNode`, `leafInputs` and `PADDING_POSTING`)
4. IF a posting field is out of range, THEN THE Root_Function SHALL throw the existing `FieldRangeError`, which names the field and the slot and holds no value (test: `samples_verify_and_roots`, which checks one out-of-range posting)

### Requirement 6: Digest message and verification

**User Story:** As a verifier, I want a signed digest I can check in the browser, so that I know which batch root the source committed to.

#### Acceptance Criteria

1. WHEN `batchId`, `merkleRoot` and `recordCount` are valid, THE Digest_Module SHALL return a `digestMessage` of fixed length that starts with an ASCII domain tag and encodes the three fields without ambiguity (test: `digest_message_unambiguous`)
2. FOR ALL two different valid triples, THE Digest_Module SHALL return messages of equal length that differ (test: `digest_message_unambiguous`)
3. IF `digestMessage` receives a non-conforming `batchId`, a root outside `0 <= root < FIELD_MODULUS`, or a count that is not an integer from 1 to 64, THEN THE Digest_Module SHALL throw (test: `digest_message_unambiguous`)
4. THE `SignedDigest` SHALL hold `batchId`, `merkleRoot` as `0x` plus 64 lowercase hex characters, `recordCount`, `signature` as lowercase hex, and a `sourceKeyId` that starts with `DEMO-` (test: `samples_verify_and_roots`)
5. WHEN a `SignedDigest` and a 32-byte public key in hex are given, THE Digest_Module SHALL resolve `verifyDigest` to true if and only if the Ed25519 signature, checked through `crypto.subtle`, covers `digestMessage` of the digest's three fields (test: `digest_tamper_detected`, which signs with an ephemeral test key and not the Demo_Key, changes each of `batchId`, root, count and the signature, and asserts false)
6. IF any input to `verifyDigest` is missing, has a wrong type, has malformed hex or the wrong length, holds a root or count out of range, or the platform lacks Ed25519, THEN THE Digest_Module SHALL resolve `false` and SHALL NOT throw or reject (test: `verify_digest_never_throws`)

### Requirement 7: Key isolation

**User Story:** As a security reviewer, I want the signing key reachable only from build scripts, so that the browser cannot re-sign an edited batch.

#### Acceptance Criteria

1. THE Sample_Writer SHALL be the only code that signs, and `src/` SHALL contain no call to `subtle.sign`, no key generation and no import or read of `scripts/` (test: `no_private_key_in_src`)
2. THE Demo_Key SHALL live in `scripts/demo-key/DEMO_ONLY_core_ledger_key.json`, with a `README.md` in the same folder that says DEMO ONLY and states why the key is public by design (test: `no_private_key_in_src`, which also checks the README text)
3. THE test `no_private_key_in_src` SHALL fail if the key file name or the private key value (base64url and hex forms) appears in `src/`, and in `public/` and `dist/` when these exist (test: `no_private_key_in_src`, example scan, one run)
4. THE `TRUSTED_SOURCE_KEYS` in `src/ledger/trusted-keys.ts` SHALL hold public keys only, keyed by `sourceKeyId`, in a file generated by the Sample_Writer from the public half of the Demo_Key and marked as generated and demo (test: `samples_reproducible`, `no_private_key_in_src`)
5. IF the Demo_Key file is missing or unreadable, THEN THE Sample_Writer SHALL exit with a non-zero status and write no file, and SHALL NOT generate a new key (test: `gen_samples_missing_key`, example)

### Requirement 8: Signed samples

**User Story:** As a judge, I want signed sample batches that load as static files, so that the demo starts without any upload.

#### Acceptance Criteria

1. WHEN the Sample_Writer runs, THE Sample_Writer SHALL write `clean.dat`, `over-limit-unflagged.dat`, `unbalanced.dat` and `large.dat` to `public/samples/`, each with a matching `.digest.json`, from `generateBatch` with a fixed seed and count per sample (test: `samples_reproducible`)
2. THE Sample_Writer SHALL write each `.digest.json` as a `SignedDigest` signed over `digestMessage` of the batch id, the Root_Function root and the posting count, with fixed key order and a final LF (test: `samples_verify_and_roots`)
3. WHEN the Sample_Writer runs twice with the same inputs, THE Sample_Writer SHALL produce byte-identical files, and the committed files and `trusted-keys.ts` SHALL equal a fresh run (test: `samples_reproducible`, example, run into a temporary directory)
4. THE committed samples SHALL verify through `verifyDigest` against `TRUSTED_SOURCE_KEYS`, SHALL have a digest root equal to the root of the parsed batch, and SHALL show the invariant results that match their kind (test: `samples_verify_and_roots`, example)
5. THE Sample_Writer SHALL print only file names and record counts (test: `samples_reproducible`, which matches every stdout line against that form)

### Requirement 9: Save hook

**User Story:** As a developer, I want the ledger and hashing tests to run when I save, so that format and parity bugs surface at once.

#### Acceptance Criteria

1. WHEN a file under `src/ledger/` or `src/zk/` is saved, THE hook SHALL run `npx vitest run tests/ledger tests/zk` with `tests/zk/proof` excluded (test: `ledger_hook_config`, example, which parses the hook file for trigger, path match, command and exclusion)
2. THE hook SHALL be a file in `.kiro/hooks/` created by a task of this spec and not by this document (test: `ledger_hook_config`)

## Decisions (huynh)

1. Option C: move `posting.ts` and `field.ts` into `src/ledger`. `structure.md` fixes the direction `zk -> ledger`, and Task 4 `toWitness(batch)` in `src/zk` imports `Batch` from `src/ledger`. Keeping the files in `src/zk` (options A and B) would make the two folders import each other.
2. Seeded sample salts are accepted, because the sample `.dat` files are public anyway. `tech.md` "Batch format" gets one line: sample salts are seeded so samples are byte-identical, and real batches use random salts.
3. Zero-padded fixed-width numbers are the canonical text form.
4. All extra tests are kept. There is no `public/samples/demo-public-key.json`: the demo public key lives in the generated `src/ledger/trusted-keys.ts`, and `structure.md` is amended to match.

## Rule notes

- `tech.md` says to reject leading-zero ambiguity. Zero padding to a fixed width gives each value exactly one text form (decision 3), so it is not ambiguity.
- Sample data is synthetic, so seeded salts (decision 2) expose no private data. No requirement above breaks a hard rule.
