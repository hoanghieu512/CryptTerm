# CryptTerm: Structure

## Layout

```
CryptTerm/
├── .kiro/
│   ├── steering/          product.md, tech.md, structure.md (more later)
│   ├── specs/             one folder per spec
│   ├── hooks/
│   └── settings/          workspace MCP config (mcp.json holds Context7); agents cannot write here, so huynh edits it
├── circuits/
│   └── ledger_audit/      Noir package: Nargo.toml, src/, in-source tests
├── src/
│   ├── ledger/            batch format, parse/serialize, types, validation
│   ├── zk/                hashing, Merkle tree, prover/verifier, worker, bundle
│   └── ui/                block-mode terminal, screens, PF keys, routing
├── scripts/               build-time tools, including the core-ledger simulator
├── public/
│   ├── samples/           signed sample batches, digests, demo public key
│   ├── _headers           COOP/COEP, only if bb.js needs them (Netlify)
│   └── _redirects         SPA fallback so the CTM900 route loads directly (Netlify)
├── docs/
│   └── writeup-notes.md   running notes for the write-up
├── netlify.toml           build command and publish directory
├── tests/                 Vitest unit and property tests, mirroring src/
├── e2e/                   Playwright tests
├── LICENSE
└── README.md
```

Do not add top-level directories without asking. The one root-level code entry point is `src/main.tsx`, with Vite config files beside it in the root.

## Module responsibilities

### `circuits/ledger_audit`

- The Noir circuit and its `nargo test` cases. The public interface is `merkle_root`, `record_count`, `limit_cents`.
- Compiled artifacts are build outputs. Do not edit them by hand. The build copies the artifact the browser needs into a place that Vite serves.
- Capacity `N` is a single named constant.

### `src/ledger`

- Owns the batch domain: types, fixed-width parse and serialize, amount parsing, account masking, totals, and the plain TypeScript check of the invariants (balance, range, limit or flag).
- Pure functions. No DOM, no React, no network, no crypto beyond what the types need.
- The column layout is defined in one place here and documented in the ledger-format spec.

### `src/zk`

- Poseidon leaf hash and Merkle root (parity with the circuit), witness building, bundle creation and parsing, the verifier steps, and the Web Worker that runs `noir_js` and `bb.js`.
- Ed25519 signature verification lives here (verification only).
- The public API is promise-based and reports progress through callbacks. The UI never touches `bb.js` directly.
- The known source public key and the expected circuit version and verification key hash are constants here, loaded from `public/samples/` or generated artifacts, never typed in by hand.

### `src/ui`

- React components for the block-mode terminal: an 80x24 grid, fields, PF key bar, status line, and one component per screen (`CTM000`, `CTM100`, `CTM200`, `CTM300`, `CTM900`).
- Screens hold presentation and input handling only. Business logic comes from `src/ledger` and `src/zk`.
- CTM900 is its own route with a shareable URL. The others run in the main terminal flow.
- Keyboard first: Enter submits the screen, PF keys map to function keys with an on-screen equivalent. Terminal state is a plain data model that tests can drive without a browser.
- Styling is a custom green-screen design with its own look. It is not an xterm clone. Keep colors, font and grid metrics in one theme module.

### `scripts`

- Build-time tools run with Node: the seeded batch generator, the Ed25519 signer, the sample writer, and artifact copy steps.
- The simulated core ledger lives in a subfolder, for example `scripts/ledger-sim/`. It holds the demo private key, labelled `DEMO ONLY`, with a README note that it is public by design.
- Scripts import from `src/ledger` and `src/zk` when they need shared types or hashing. The reverse is forbidden.
- The generator is deterministic from a seed and is also imported by tests.

### `public/samples`

- Generated, signed artifacts: the batch files, their signed digests, and the demo public key. Produced by `scripts/`. Do not hand-edit. Regenerate them instead.
- Sample set: clean, unflagged over-limit, unbalanced, large.

### `tests`

- Vitest tests mirror `src/`: `tests/ledger/`, `tests/zk/`, `tests/ui/`. Property tests use the `*.prop.test.ts` suffix and example tests use `*.test.ts`.
- Shared arbitraries (fast-check generators for postings and batches) live in `tests/support/`.
- The PBT bug log lives in `tests/PBT-LOG.md`.
- Circuit tests are in the Noir package, not here.

### `e2e`

- Playwright specs for the judge path and both tamper cases. They run against a built, served copy of the app.

## Dependency direction

```
ui  ->  zk  ->  ledger
scripts  ->  zk, ledger
tests, e2e  ->  anything
```

- `src/ledger` imports nothing from `src/zk` or `src/ui`.
- `src/zk` imports from `src/ledger` only.
- `src/ui` imports from `src/zk` and `src/ledger`.
- Nothing under `src/` imports from `scripts/`, `tests/` or `e2e/`. This is also how the demo private key stays out of the browser bundle.

## Naming and style

- Files: `kebab-case.ts`. React components: `PascalCase.tsx`. Screen components use their screen id, for example `Ctm300Prove.tsx`.
- Noir: `snake_case` for functions, variables and files, `UPPER_SNAKE` for constants.
- Domain names are consistent across languages: `merkle_root`, `record_count`, `limit_cents` in the circuit and in the bundle JSON, `merkleRoot`, `recordCount`, `limitCents` in TypeScript.
- Money values in TypeScript use a `Cents` type alias for `bigint`. Variables and fields that hold money end in `Cents`.
- Prefer named exports. Keep modules small and single-purpose.
- TypeScript is strict. No `any` without a comment explaining why.

## Specs

Specs go in `.kiro/specs/<name>/` with `requirements.md`, `design.md` and `tasks.md`. Planned specs, in build order:

1. `ledger-format` (format, generator, signing, parser)
2. `zk-core` (circuit and JS hashing parity, proof bundle)
3. `verifier` (verifier logic and CTM900)
4. `terminal-ui` (CTM000 to CTM300, tamper mode)

Requirements trace to tests. Each acceptance criterion names the test or property that covers it.

## Root files

- `LICENSE` is MIT unless huynh chooses Apache-2.0.
- `README.md` states the trust model, including that the demo key is public by design, and explains how to reproduce the samples.
- Keep the `.kiro/` directory under version control and do not add it to `.gitignore`. It is part of the submission.

## Evidence before status

- A task is marked completed only after its "Done when" check has been run in this session, and the report quotes the actual command and its output (`git log -1 --oneline` for commits, `ls` or a file listing for created files, the test summary line for tests).
- Never report a commit hash, a file, a size or a command output that was not produced in this session.
- If a sub-agent is ever used, its claims are verified on disk before the status changes.
