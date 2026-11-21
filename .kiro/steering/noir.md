---
inclusion: fileMatch
fileMatchPattern: ["circuits/**", "src/zk/**"]
---

# CryptTerm: Noir and proving toolchain notes

This file loads when working on `circuits/**` or `src/zk/**`.

## Version pins

Pin exact versions. No `^` or `~` ranges. No `latest` tags.

| Component | Pin | Status |
|-----------|-----|--------|
| `nargo` | `1.0.0` | Pinned. |
| `bb` (CLI) | `6.0.0` | Pinned. |
| `@noir-lang/noir_js` | `1.0.0` | Pinned. Exists on npm. |
| `@noir-lang/acvm_js` | `1.0.0` | Pinned. Exists on npm. Must equal the `noir_js` version. |
| `@noir-lang/noirc_abi` | `1.0.0` | Pinned. Exists on npm. Must equal the `noir_js` version. |
| `@noir-lang/types` | `1.0.0` | Pinned. Exists on npm. Must equal the `noir_js` version. |
| `@aztec-foundation/bb.js` | `6.0.0` | Pinned. Exists on npm. Not yet shown to work with `noir_js` 1.0.0 (see below). |

### `bb.js` package name

On 2026-11-18, `bb.js` is published as `@aztec-foundation/bb.js`, whose `latest` is `6.0.0`. The older name `@aztec/bb.js` stops at `5.3.0` and has no `6.0.0`. Use only `@aztec-foundation/bb.js`. Do not install `@aztec/bb.js`.

Open check for the spike: that the `@aztec-foundation/bb.js` 6.0.0 build proves and verifies with a witness from `noir_js` 1.0.0, and that its proofs and verification key match what the `bb 6.0.0` CLI produces. The official Noir tutorial page still targets `1.0.0-beta.20`, so do not copy its versions.

### Rules for the pins

- `nargo`, `bb`, `noir_js` (with its three sibling packages) and `@aztec-foundation/bb.js` are upgraded together, in one task, never singly.
- The circuit is compiled with the pinned `nargo`. The compiled artifact must record the compiler version. The verifier checks `circuit_version` and the verification key hash against the artifact it ships.
- After any pin change, rerun `nargo test`, the JS-versus-circuit parity property, and a full prove-and-verify in the browser, and update this file.
- Check what is actually installed before relying on it: `nargo --version`, `bb --version`, and `npm ls @noir-lang/noir_js @aztec-foundation/bb.js`. If the output disagrees with the table, stop and tell huynh.

## Look up Noir syntax, never recall it

- Before writing or changing any Noir code, `Nargo.toml`, `noir_js` code or `bb.js` code, look up the current documentation through the docs MCP. Do not write from memory.
- Noir syntax and the standard library change between releases. Apply this to function and attribute syntax, `#[test]` forms (including `should_fail`), integer types and casts, `assert` forms, the Poseidon and Merkle helpers in the standard library, and the `noir_js` and `bb.js` APIs (witness execution, proof generation, verification key handling, and worker usage).
- Look up the documentation for the pinned version (`1.0.0` for Noir). If the docs MCP returns material for a different version, say so and do not use it blindly.
- If no docs MCP is available in the session, tell huynh and wait. Do not fall back to memory. Fetching the official documentation for the pinned version is acceptable if huynh agrees. Editing MCP config happens only when huynh asks.
- Record what you looked up in the task notes: the page or topic, and the version it applies to.

## Docs MCP: Context7

The Context7 MCP server (`@upstash/context7-mcp@4.7.3`) provides two tools: `resolve-library-id` and `query-docs`. Skip the resolve step by using these IDs directly:

| Library ID | Content | Notes |
|------------|---------|-------|
| `/noir-lang/noir` | The Noir repository: language, examples, `noir_js` and `acvm_js` READMEs | Reflects the `master` branch, not `1.0.0`. |
| `/websites/noir-lang` | The Noir documentation site | Not version-pinned either. |

Context7 is not authoritative for package names or versions. On 2026-11-18 it returned `@aztec/bb.js` in an example, while the npm registry has `@aztec-foundation/bb.js` at `6.0.0` and `@aztec/bb.js` stopping at `5.3.0`. For every package name and version, cross-check Context7 against `npm view <package> dist-tags` and the published package source. When they disagree, the registry wins. Say so and record the difference in the version quirks log.

## Where version-sensitive choices must be written down

Record these in the sections below once the spike settles them. Do not leave them implicit in code.

- Poseidon variant and parameters, and the exact field encoding of leaf inputs, used by both the circuit and `src/zk`.
- The padding leaf definition.
- The Merkle tree layout and the hash used for inner nodes.
- How the compiled circuit artifact reaches the browser, and how the verification key hash is computed.
- Whether `bb.js` runs single-threaded without cross-origin isolation, and the settings that make that work.

## API as looked up (2026-11-18)

Sources: the Noir "web app with NoirJS" tutorial (it targets `1.0.0-beta.20`, so only the call shapes are used), plus the published type definitions and source of `@noir-lang/noir_js@1.0.0` and `@aztec-foundation/bb.js@6.0.0`.

```ts
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec-foundation/bb.js';

const noir = new Noir(circuit);                       // circuit = compiled nargo JSON
const { witness } = await noir.execute(inputs);       // UNVERIFIED: believed to throw on a failed constraint
const api = await Barretenberg.new({ threads: 1 });   // single-threaded, no COOP/COEP needed
const backend = new UltraHonkBackend(circuit.bytecode, api);
const { proof, publicInputs } = await backend.generateProof(witness);
const ok = await backend.verifyProof({ proof, publicInputs });
const vk = await backend.getVerificationKey();        // Uint8Array
```

- **Unverified, test first in the spike:** that `noir.execute` throws when a constraint fails. Neither Context7 nor the `noir_js` 1.0.0 type definitions state it. The first tamper case (unbalanced batch) depends on it. Before any UI code relies on it, write a test that executes the circuit with an unbalanced witness and records what happens (a thrown error, or a witness that fails later at proof time) and the exact error shape. Replace this bullet with the result.
- **Observed in Node, 2026-11-21 (task 6.7; browser observation pending huynh's run, so the "Unverified" bullet above stays):** `noir.execute` THROWS at the failed constraint and returns no witness. Checked for the unbalanced, wrong-root and over-limit-unflagged witnesses on `noir_js` 1.0.0. The thrown value is a plain `Error` with own properties `stack`, `message`, `callStack` (opcode location strings), `rawAssertionPayload` (`{ selector, data }`), `acirFunctionId`, `brilligFunctionId` and `noirCallStack` (source text and `path:line:column`). `message` is `Circuit execution failed: ` plus the fixed assertion text (for example `Circuit execution failed: DEBITS NOT EQUAL TO CREDITS`), and neither the message nor any own property contained a `record_id`, `account`, `amount` or `salt` value. Errors from `abiEncode` are a different path and can echo values (E-3). Details: `docs/spike-results.md` "Node pre-check (task 6.7)", test `tests/zk/circuit-inputs.test.ts`.
- `execute` also accepts an optional `foreignCallHandler` as its second argument and returns `returnValue` alongside `witness`. This circuit needs neither.
- `generateProof` defaults to zero-knowledge on, with the `poseidon2` oracle hash. `verifyProof` must use the same options as `generateProof`.
- The tutorial also initializes `@noir-lang/acvm_js` and `@noir-lang/noirc_abi` WASM explicitly in the browser, passing the `.wasm` URLs from Vite.
- `threads: 1` comes from the bb.js README (5.3.0) and the `BackendOptions` type. Confirm it on 6.0.0 during the spike.

## Settled choices

Circuit-side choices, settled by task 2.10 (2026-11-20) from `circuits/ledger_audit/src/` and checked by the `_matches_bb_js` tests. `src/zk` must use the same values. The size, SRS and single-thread items are placeholders until the later groups measure them.

### Hash_Variant

Poseidon2 on BN254 through `std::hash::poseidon2_permutation` (state width 4, rate 3). The capacity element `state[3]` starts at `len * 2^64` (`len` is the number of input fields), inputs are added into `state[0..2]` three at a time, the permutation runs after each block, and the output is `state[0]`. This is the `poseidon2Hash` convention of `@aztec-foundation/bb.js` 6.0.0. Field elements are 32-byte big-endian in bb.js. Decision D3: the sponge is written in-repo in `hash.nr` (no `noir-lang/poseidon` dependency, no git dependency). Exactly two call shapes exist:

| Function | Permutations | Definition | Equals bb.js |
|----------|--------------|------------|--------------|
| `node_hash(left, right)` | 1 | `permute([left, right, 0, 2 * 2^64])[0]` | `poseidon2Hash([left, right])` |
| `leaf_hash(f: [Field; 6])` | 2 | `s = permute([f0, f1, f2, 6 * 2^64])`, then `permute([s0 + f3, s1 + f4, s2 + f5, s3])[0]` | `poseidon2Hash([f0..f5])` |

Do not use the Noir stdlib `Poseidon2Hasher`: it differs from bb.js for lengths that are multiples of 3 (see the quirks log).

### Leaf and field encodings

- Leaf field order: `[record_id, account, side, amount, review_flag, salt]` (`leaf_fields()` in `posting.nr`). `side`, `amount` and `review_flag` are cast to `Field`.
- `record_id` and `account`: unsigned integer 0 to 2^64 - 1, decimal string in the circuit inputs, 32-byte big-endian when hashed in TypeScript. `salt`: unsigned integer 0 to 2^248 - 1 (31 bytes). Leading zeros are not representable.
- In `posting.nr` all three are declared `Field`. **The circuit does not range-check them.** The 2^64 and 2^248 limits are enforced only by the TypeScript Witness_Builder (`FieldRangeError`, Requirement 3.10). Do not assume a circuit-side check.
- Padding_Posting: all six fields zero (`padding_posting()`), so its leaf is `PAD_LEAF`. Side D and flag N are valid encodings, so no extra value is needed. The circuit forces every slot at index `>= record_count` to equal it in all six fields.
- Numeric values: `side` D = 0, C = 1. `review_flag` N = 0, Y = 1.

### Merkle layout

64 leaves, depth 6 (`N` and `DEPTH` in `main.nr`, `static_assert(1 << DEPTH == N)`). Slot `i` is leaf `i` at position `i` of level 0, and every slot is hashed, real or padding. Parent `j` of level `l + 1` is `node_hash(level_l[2j], level_l[2j + 1])` (left child `2j`, right child `2j + 1`). The root is level 6. `merkle.nr` uses one numeric-generic `halve<IN, OUT>` helper, which compiled on 1.0.0, so the six `halve_*` fallbacks were not needed. All-padding levels, computed with bb.js `poseidon2Hash`, level `l + 1 = node(level l, level l)`:

| Level | Value |
|-------|-------|
| 0 (`PAD_LEAF`) | `0x0286f724918d0f8663988824651273d4703d44b1cef1a9a31e4d1f6e0d35e8f8` |
| 1 | `0x1b3d40de538ba8f1f0c867584f556a4e9fff88f9581752f57e1cf361e50096ce` |
| 2 | `0x1e6fb0e72009de192abf34a6ba4452d2d8ce769cc1cb65de11981dc03de0691f` |
| 3 | `0x2ed442569f7fb84df1cc04358a8b1b250f00273f6c72e08aba24ee6e6e8d3ab3` |
| 4 | `0x1e3f41304522a00121bac973d7762885b97c8b7387a4ece55cece1da229d2e00` |
| 5 | `0x1bf3a1577da89a0905233c0977ae02c54d2f72decab4ecdd12f829db4ae903e9` |
| 6 (`EMPTY_ROOT`) | `0x22d28221a316eb2b0ae742ae204890369a507e2d66bd93314f8f56c697af75c8` |

### Noir integer types

| Value | Noir type | Note |
|-------|-----------|------|
| `merkle_root` | `Field` (public) | |
| `record_count` | `u32` (public) | 0 and 65 are encodable, so both bounds are testable. |
| `limit_cents` | `u64` (public) | |
| `side`, `review_flag` | `u8` | Value 2 is encodable, so the explicit checks are testable. |
| `amount` | `u64` | `AMOUNT_BOUND` = 2^40 (exclusive). |
| `record_id`, `account`, `salt` | `Field` | As declared in `posting.nr`. Not range-checked in the circuit. |
| `debit_total`, `credit_total` | `u64` | Each amount is below 2^40 after constraint 6, so each sum is below 2^46 and cannot overflow. |

No signed integer, float or `unconstrained` function. `||` and `&&` do not exist in Noir 1.0.0: the circuit uses `|` and `&` on `bool`.

### Constraints, in `main` order

Messages are string literals, unique, and none is a substring of another. In nargo 1.0.0, matching in `#[test(should_fail_with = "...")]` is a case-insensitive substring match.

| # | Constraint | Message |
|---|------------|---------|
| 1 | `record_count >= 1` | `RECORD COUNT BELOW 1` |
| 2 | `record_count <= N` | `RECORD COUNT ABOVE CAPACITY` |
| 3 | `limit_cents < 2^40` | `LIMIT OUT OF RANGE` |
| 4 | per slot: `side <= 1` | `SIDE NOT D OR C` |
| 5 | per slot: `review_flag <= 1` | `FLAG NOT Y OR N` |
| 6 | per slot: `amount < 2^40` | `AMOUNT OUT OF RANGE` |
| 7 | per slot: `i < record_count`, or all six fields zero | `PADDING SLOT NOT NEUTRAL` |
| 8 | root of all 64 leaves equals `merkle_root` | `MERKLE ROOT MISMATCH` |
| 9 | sum of D amounts equals sum of C amounts (`u64`) | `DEBITS NOT EQUAL TO CREDITS` |
| 10 | for `i < record_count`: `amount <= limit_cents` or `review_flag == 1` | `OVER LIMIT WITHOUT REVIEW FLAG` |

Range checks (3 to 6) run before any sum or comparison that relies on them.

### Known-answer vectors

Copied from `circuits/ledger_audit/src/tests.nr`. All are field elements, big-endian hex. `leaf(...)` is `leaf_hash` and `node(...)` is `node_hash`.

| Name | Inputs | Output |
|------|--------|--------|
| `PAD_LEAF` | `leaf([0, 0, 0, 0, 0, 0])` | `0x0286f724918d0f8663988824651273d4703d44b1cef1a9a31e4d1f6e0d35e8f8` |
| `LEAF_A` | `leaf([1, 1000000000000001, 0, 250000, 1, 987654321])` | `0x259c4874e82dc29fd6b1cf8be4d604bceaebdd7c7c2a9a4052444cfc9d25a1ad` |
| `LEAF_B` | `leaf([2, 1000000000000002, 1, 250000, 0, 123456789])` | `0x00a9e776d5c445c897eb24ef60bd057ef514d00fcb40bcf89a6d7cde29f5b1e8` |
| `NODE_A` | `node(LEAF_A, LEAF_B)` | `0x2f83e3c909349719e9cb57a5d79a7a0989f971c02246fe6fc9d47e882b600af4` |
| `NODE_SMALL` | `node(7, 8)` | `0x1f7a903ff6ebf6088f018bef42d630d28cc499eec89bec2ba6cc2763da3b957c` |
| `EMPTY_ROOT` | root of 64 `PAD_LEAF` leaves (levels 1 to 6 of `node(x, x)`) | `0x22d28221a316eb2b0ae742ae204890369a507e2d66bd93314f8f56c697af75c8` |

### Not yet measured

- Circuit size and the chosen SRS point count: measured by task 5.1 on 2026-11-21 (this item is no longer a placeholder).
  - Artifact: `src/zk/artifacts/ledger_audit.json`, sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`. Settings: `PROOF_SETTINGS` = `ipaAccumulation: false`, `oracleHashType: 'poseidon2'`, `disableZk: false`, `optimizedSolidityVerifier: false`.
  - `numGates` = 21212. `numGatesDyadic` = 32768 (= 2^15, already a power of two). `numAcirOpcodes` = 4580.
  - `requiredPoints = max(numGatesDyadic, 512)` = 32768. Chosen point count `N` = 32768 = 2^15 (smaller than 2^16 = 65536, so the 2^16 guess is not used). The g1 file is `N * 64` = 2097152 bytes (2 MiB).
  - Method: `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })`, then `circuitStats({ circuit: { name: 'ledger_audit', bytecode, verificationKey: new Uint8Array(0) }, includeGatesPerOpcode: false, settings: PROOF_SETTINGS })` on the base64-decoded, gunzipped `bytecode`, then `destroy()`. No SRS was loaded and no network use was seen.
  - Cross-check: `~/.bb/bb gates -b circuits/ledger_audit/target/ledger_audit.json -t noir-recursive` printed `acir_opcodes` 4580 and `circuit_size` 21212, the same as `numAcirOpcodes` and `numGates`. The CLI prints no dyadic size.
  - Open: `numGatesDyadic` is the `circuitStats` size, not the prover's own dyadic size (the prover adds 5 rows and counts lookup-table placement). The margin is 11556 rows. The first full prove with exactly `N` points (group 7) settles it. If it throws `too many points`, repeat 5.2 with the next power of two.
- SRS files, recorded by task 5.2 on 2026-11-21 (Aztec Ignition ceremony data, vendored in `src/zk/artifacts/srs/`, manifest `srs.sha256.json`). Format `bn254-g1-uncompressed-be64`: 64 bytes per point (x then y, 32 bytes big-endian each), no header, `pointCount` = 32768, `bytesPerPoint` = 64.
  - `g1.dat`: source `https://crs.aztec-cdn.foundation/g1.dat`, mirror `https://crs.aztec-labs.com/g1.dat`, byte range `bytes=0-2097151` (HTTP 206, `Content-Range: bytes 0-2097151/6400000000`), 2097152 bytes, sha256 `50d2f4e9567be2b8e382cedfd078b96a3428a94597b7e88c4116e105d578ce77`. The first point is the generator (1, 2).
  - `g2.dat`: source `https://crs.aztec-cdn.foundation/g2.dat`, mirror `https://crs.aztec-labs.com/g2.dat`, whole file (no byte range), 128 bytes, sha256 `01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f`.
  - The mirror returned byte-identical content for both files. The independent re-verification script is `scripts/verify-srs.ts` (task 5.5).
- Single-thread answer and settings (`threads: 1`, no cross-origin isolation): recorded by the worker tasks (group 7), not yet measured.

## Version quirks log

Append dated entries as they are found, each with the component, the version, what happened, and the workaround.

- 2026-11-18, `bb.js`: the package is published as `@aztec-foundation/bb.js` (`latest` is `6.0.0`). The old name `@aztec/bb.js` stops at `5.3.0`. The Noir tutorial and Context7 examples still show the old name.
- 2026-11-19, `@aztec-foundation/bb.js`: the registry `latest` tag moved from `6.0.0` (observed 2026-11-18) to `6.1.0`; re-confirmed 2026-11-20. The pin stays `6.0.0`, so never install by tag and always use the exact version.
- 2026-11-19, Context7: the libraries `/noir-lang/noir` and `/websites/noir-lang` return "master branch content", not `1.0.0`, which is the pinned version. Where behaviour matters, read the tagged `v1.0.0` source instead.
- 2026-11-19, Noir stdlib `1.0.0`: `noir_stdlib/src/hash/mod.nr` and `poseidon2.nr` at tag `v1.0.0` expose only `std::hash::poseidon2_permutation` publicly, and the `Poseidon2Hasher` sponge is `pub(crate)`. Its sponge also differs from `bb.js` `poseidon2Hash` for input lengths that are multiples of 3, and the leaf hash takes six fields, which is exactly that case. Workaround (decision D3): the sponge is written in-repo in `circuits/ledger_audit/src/hash.nr` on top of the permutation, and a scratch test checked it against the six provisional vectors from the design (task 2.2, 2026-11-20).
