# CryptTerm: Tech

## Stack

| Area | Choice |
|------|--------|
| App | Vite, React, TypeScript (strict), static build |
| Circuit | Noir, `nargo 1.0.0` |
| Prover backend | `bb 6.0.0`, UltraHonk |
| In-browser proving | `noir_js` and `bb.js`, run in a Web Worker |
| Signatures | Ed25519 |
| Tests | Vitest, fast-check (property tests), Playwright (e2e), `nargo test` (circuit) |
| Hosting | Netlify, static only |
| License | MIT |

Pin exact versions of every toolchain package and npm dependency (no `^` or `~`). The `noir_js` and `bb.js` versions must match `nargo 1.0.0` and `bb 6.0.0`. Record the pinned versions and any version-specific quirks in a Noir notes steering file once the spike has run. Do not rely on memory of Noir or bb.js APIs, because they change between releases. Check current docs (documentation MCP, if configured) before writing circuit or prover code.

## Hard rules

These apply to every change. If a task seems to need breaking one, stop and ask.

### Amounts

- Amounts are `bigint` cents in TypeScript and an integer type in Noir. Floats are never used for money, including intermediate calculations and parsing.
- Never use `Number` for an amount. Never use `parseFloat`, or `parseInt` on an amount. Never format an amount by dividing by 100 in floating point.
- Parse amounts from strict digit-only text. Reject signs, decimals, exponents, whitespace and leading-zero ambiguity at the parser.
- Every amount is range-checked against `0 <= amount < 2^40`, in TypeScript and in the circuit.
- Tests must cover values near `2^53` and near the field modulus. They must be rejected, not wrapped.

### Data stays in the browser

- No network call may carry batch contents, postings, accounts, amounts, salts or the private witness. This covers `fetch`, XHR, WebSocket, `sendBeacon`, image pings and form posts.
- No analytics, telemetry or error-reporting services.
- No logging of batch data (`console.*`, error messages, thrown values, status line text beyond counts and identifiers). Log batch id and record counts at most.
- Samples are loaded as static files from `public/samples/`. That is a download of signed artifacts, not an upload of private data.
- The proof bundle contains only public values. A test must assert this by checking the bundle's keys against an allow-list.

### Keys

- The browser bundle contains only the demo public key and signed artifacts. It never contains a private key.
- The demo private key lives in the generator folder under `scripts/`, labelled `DEMO ONLY`. A test or build check must fail if a private key can be reached from `src/`.
- Do not add a signing path to the browser. Tamper mode must not be able to re-sign.

### Authorship

All code in the repo is written by Kiro. Do not paste code from other assistants or hand-written patches into commits.

## Circuit (`circuits/ledger_audit`)

- Fixed capacity `N = 64` postings. Raise to 128 only if the spike shows headroom.
- Unused slots are padding postings with amount 0. They are bound into the tree like any other leaf, and they cannot affect sums.
- Leaf is a Poseidon hash of the posting fields, including the per-record salt. The root covers all `N` leaves.
- Public inputs: `merkle_root`, `record_count`, `limit_cents`. Everything else is private.
- Constraints, all required:
  1. The recomputed root equals `merkle_root`.
  2. Every amount is range-checked (`< 2^40`) so field arithmetic cannot wrap.
  3. The sum of `D` amounts equals the sum of `C` amounts.
  4. For every real posting, `amount <= limit_cents` or the review flag is `Y`.
  5. Slots with index `>= record_count` are padding (amount 0, no flag effect).
- Also constrain: `side` is exactly one of D or C, `flag` is exactly one of Y or N, and `record_count <= N`. Constrain booleans explicitly. Do not assume the witness is well-formed.
- Signature verification stays outside the circuit. The circuit only binds private data to the signed root.
- Soundness rules:
  - No constraint may depend on a value the prover chooses freely and the verifier does not check.
  - Every comparison on a field element needs a prior range check, or it is meaningless.
  - Do not use `unconstrained` functions for results that are not then constrained.
  - Every constraint needs a failing `nargo test` (`#[test(should_fail)]` or `should_fail_with`), not only passing cases.
- Treat circuit changes as security changes. Run the soundness-reviewer agent (Opus 5.5) before merging a circuit change that alters constraints.

### JS and circuit parity

- The TypeScript side computes the same leaf hash and root as the circuit, with the same Poseidon variant, parameters, field encoding and padding rule. Document these choices in the ZK core spec.
- Parity is a tested property. For random batches, the TypeScript root must equal the root the circuit computes.
- If the circuit hashing changes, the TypeScript hashing and the committed samples change in the same task.

## Batch format

- Fixed-width text records in a COBOL-batch style, one posting per line, plus a header record and a trailer record (batch id, count).
- Posting fields: record id, account (masked in the UI, still private), side `D` or `C`, amount in integer cents, review flag `Y` or `N`, and a random per-record salt (private, written by the core ledger).
- The salt goes into each leaf hash. It stops the public root from being used to test guesses about low-entropy fields such as amounts and flags. It is part of the format from the first spike.
- The exact column layout is documented in the ledger-format spec. `parse(serialize(x))` must equal `x` exactly, and `serialize(parse(text))` must equal `text` for valid text.

## Proof bundle

A JSON file with: `batch_id`, `record_count`, `merkle_root`, `limit_cents`, `signature`, `source_key_id`, `proof`, `circuit_version`, `verification_key_hash`. Nothing private. Bigint-valued fields serialize as decimal strings, never as JSON numbers.

## Verifier order

The verifier runs these steps in this order and reports the first failing step by name:

1. Signature over `(batch_id, merkle_root, record_count)` verifies against the known source key.
2. The bundle's public inputs match the signed digest.
3. The bundle's `limit_cents` equals the verifier's expected policy limit (default 1,000,000, editable on CTM900).
4. The `circuit_version` and verification key hash match what the verifier ships.
5. The UltraHonk proof verifies.

## Proving in the browser

- Proof generation and verification run in a Web Worker. The UI thread only renders progress.
- Do not assume cross-origin isolation. The default path is single-threaded and must work without COOP/COEP headers. Multithreading is a bonus if it works.
- If bb.js needs COOP/COEP, set them in `public/_headers`, which Vite copies to the publish directory root and Netlify reads. Make sure the app still works when they are absent.
- Gate for the spike, measured on the deployed Netlify URL in Chrome on huynh's Mac, forced single-threaded, cold start including WASM download and init:
  - total under 30 s, and
  - under 60 s with Chrome DevTools 4x CPU throttling.
  - Failing either means switching to option B.
- Proof generation must fail clearly when an invariant is violated. Map witness-generation errors to a named invariant in the terminal copy, for example the unbalanced case.

## Testing

Property tests (fast-check with Vitest) cover at least these:

- Batch parse and serialize round-trip.
- JS root equals circuit root for random batches.
- A proof succeeds if and only if the batch balances and respects the limit/flag rule.
- Out-of-range and overflow-style amounts (near `2^53`, near the field size) are rejected.
- Any single-cent change changes either validity or the root.

Other rules:

- Circuit-level cases run under `nargo test`.
- The seeded sample generator is deterministic and shared between tests and the build script. Same seed, same bytes.
- Property tests use fixed, logged seeds in CI so failures reproduce. When a property finds a real bug, add a regression example test and append an entry to the PBT bug log.
- Proof generation is slow. Run the full-proof properties with a small `numRuns` and keep cheap properties (parse, root parity, validity rule in TypeScript) at high `numRuns`.
- Playwright e2e covers the judge path (load sample, prove, verify, VERIFIED) and both tamper cases.

## Hosting and build

- Static output only. No server code, no functions, no runtime environment secrets.
- Netlify serves the Vite build output. Build command and publish directory (`dist`) are set in `netlify.toml` at the repo root. No secrets in it.
- Netlify reads two plain-text files from the publish directory. Both names start with an underscore and have no extension, so each lives in `public/` and Vite copies it to `dist/`:
  - `public/_headers` sets COOP/COEP, only if bb.js needs them. Custom headers apply only to files Netlify serves from its own store, which covers every file in this app.
  - `public/_redirects` is the SPA fallback so that the CTM900 route and its shareable URL load on a direct visit or refresh. The rule is `/*  /index.html  200`.
- Keep `netlify.toml`, `public/_headers` and `public/_redirects` under version control. Files named `headers` or `redirects` without the underscore are ignored by Netlify.
- Deploy with the Netlify CLI through the installed Netlify power. Do a non-production deploy (`netlify deploy`) unless huynh asks for production. Before any deploy, check `netlify status` and tell huynh which site and account it targets.
- A deploy publishes only the `dist/` folder, which contains signed samples and the demo public key. If a deploy would include anything else, stop and ask.
- Sample batches and the circuit artifact are built by scripts, not hand-edited. Build scripts must be reproducible from the repo.
- Add a build or CI check that scans `src/` for network APIs, and for `console.*` calls that could print batch data.

## Kiro workflow

- Steering: product, tech, structure. Add a security steering file and a version-pinned Noir notes file later.
- Specs, each with requirements, design and tasks: ledger format and generator, ZK core (circuit plus JS hashing parity), terminal UI, verifier.
- Hooks: on save of `.nr` files run `nargo test`. On save of ledger or zk TypeScript run the property tests. A hook scans for network calls or logging of batch data. A hook keeps the write-up notes file current.
- MCP: a documentation MCP for current Noir and bb.js docs, and a browser-automation MCP for UI checks if useful. Edit MCP config only when huynh asks.
- Custom agents (Kiro CLI): a circuit-soundness reviewer and a block-mode UI agent.
- IDE for specs and hooks. CLI for headless tasks and custom agents.
- Check which Kiro powers exist at build time before relying on any.
- Default model Sonnet 5.5. Opus 5.5 only for circuit soundness review.
