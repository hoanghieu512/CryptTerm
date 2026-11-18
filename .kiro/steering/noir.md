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
- `execute` also accepts an optional `foreignCallHandler` as its second argument and returns `returnValue` alongside `witness`. This circuit needs neither.
- `generateProof` defaults to zero-knowledge on, with the `poseidon2` oracle hash. `verifyProof` must use the same options as `generateProof`.
- The tutorial also initializes `@noir-lang/acvm_js` and `@noir-lang/noirc_abi` WASM explicitly in the browser, passing the `.wasm` URLs from Vite.
- `threads: 1` comes from the bb.js README (5.3.0) and the `BackendOptions` type. Confirm it on 6.0.0 during the spike.

## Settled choices

None yet. Fill this section in during the spike.

## Version quirks log

Append dated entries as they are found, each with the component, the version, what happened, and the workaround.

- 2026-11-18, `bb.js`: the package is published as `@aztec-foundation/bb.js` (`latest` is `6.0.0`). The old name `@aztec/bb.js` stops at `5.3.0`. The Noir tutorial and Context7 examples still show the old name.
