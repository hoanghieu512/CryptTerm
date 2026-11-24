# CryptTerm

## What CryptTerm is

CryptTerm is a block-mode terminal web app. A bank operations engineer proves, with a zero-knowledge proof generated in the browser, that a signed settlement batch balances (the sum of debits equals the sum of credits) and that every posting is within a policy limit or carries a review flag. The proof reveals no posting, account, amount or customer data. A separate verifier screen (CTM900, route `/verify`) checks the proof bundle and answers VERIFIED, or REJECTED with the failing step.

The app is a static site. Proof generation and verification run in a Web Worker, and no batch data leaves the browser. It was built for Kiroween 2026, category Resurrection.

## Trust model

- A simulated core ledger emits a batch file plus a signed digest. The digest is an Ed25519 signature over `(batch_id, merkle_root, record_count)`, made with a demo core-ledger key.
- The verifier trusts the core-ledger public key. It ships in the verifier as the known source key and is labelled as a demo key.
- The proof shows that the private postings hash to `merkle_root` and that the invariants hold.
- The verifier checks the signature outside the circuit. It then checks that the proof's public inputs match the signed digest and the expected policy, and then verifies the proof.
- Sample batches are generated and signed at build time by a repo script. The browser bundle contains only signed artifacts and the public key, never the private key.
- The demo private key is committed in the generator folder and labelled `DEMO ONLY`, so judges can reproduce the samples. The README and pitch state plainly that this key is public by design. In production it lives in the core system or an HSM.
- Consequence: an edited batch cannot be re-signed in the browser. The tamper demo depends on this.
- **Policy limit:** the limit is the verifier's policy, not the prover's choice. The verifier holds the expected `limit_cents` (default 1,000,000 cents, editable on CTM900) and rejects any bundle whose public `limit_cents` differs. The prover's CTM300 field is prefilled with the same default. A looser limit produces a bundle that the verifier rejects at the policy step.

The demo signing key is `DEMO ONLY` and public by design. It is not a protected secret. The samples and the demo data are demo data.

## The two tamper cases

Load a sample on CTM100, open CTM200 and press PF12 to enter tamper mode, where one amount is edited in place.

1. **Edit one amount by 1 cent.** The debits no longer equal the credits. Proof generation fails and names the invariant: `REJECTED: UNBALANCED`.
2. **Move 1 cent between two postings.** The batch still balances, so the proof generates. The root no longer matches the signed digest, so the verifier answers `REJECTED AT DIGEST_MATCH`.

## Run locally

Requires Node 22.12 or newer. The circuit tests also need `nargo 1.0.0`.

```bash
npm ci                  # install the exact versions pinned in package.json
npm run dev             # start the Vite dev server
npm test                # Vitest and fast-check
npm run test:circuit    # Noir circuit tests, needs nargo 1.0.0
npm run test:proof      # full-proof tests
npm run test:e2e        # Playwright, against a built and served copy of the app
```

## Regenerate samples and circuit identity

```bash
npm run gen:samples     # rewrite public/samples from the seeded generator and the demo key
npm run gen:identity    # rewrite the circuit version and verification key hash the verifier ships
```

The samples are byte-identical on every run, because the generator is seeded.

## Stack and versions

Runtime dependencies:

- `@aztec-foundation/bb.js` 6.0.0
- `@noir-lang/acvm_js` 1.0.0
- `@noir-lang/noir_js` 1.0.0
- `@noir-lang/noirc_abi` 1.0.0
- `@noir-lang/types` 1.0.0
- `react` 19.3.1
- `react-dom` 19.3.1

Development dependencies:

- `@playwright/test` 1.62.0
- `@types/node` 24.19.2
- `@types/react` 19.3.0
- `@types/react-dom` 19.3.0
- `@vitejs/plugin-react` 6.3.0
- `fast-check` 4.10.3
- `typescript` 7.0.2
- `vite` 8.3.8
- `vitest` 5.1.1

Circuit toolchain: Noir `nargo 1.0.0`, `bb 6.0.0` (UltraHonk). Hosting is static, on Netlify (`netlify.toml`).

## How Kiro was used

- Specs in `.kiro/specs/`: `zk-spike`, `ledger-format`, `zk-core`, `verifier`, `terminal-ui` and `release`, each with requirements, design and tasks.
- Steering files in `.kiro/steering/`: `product.md`, `tech.md`, `structure.md`, `security.md` and `noir.md`.
- Save hook `ledger-save` (`.kiro/hooks/ledger-save.json`): runs the ledger and zk tests when a file under `src/ledger` or `src/zk` is saved.
- Custom agent `circuit-auditor` (`.kiro/agents/circuit-auditor.json`): a read-only auditor for the Noir circuit and its TypeScript parity.
- Property tests with fast-check (`tests/**/*.prop.test.ts`) cover parsing, root parity, amount ranges and the verifier order.
- Bugs that property tests found are logged in `tests/PBT-LOG.md`. Running notes are in `docs/writeup-notes.md`.

## License

MIT. See `LICENSE`.
