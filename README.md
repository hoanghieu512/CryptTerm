# CryptTerm

A block-mode terminal web app. A bank operations engineer proves, with a zero-knowledge proof generated in the browser, that a signed settlement batch balances (sum of debits equals sum of credits) and that every posting is within a policy limit or carries a review flag. The proof reveals no posting, account, amount or customer data. A separate verifier screen checks the proof bundle.

Built for Kiroween 2026, category Resurrection.

> **Status: scaffold only.** The app, circuit and verifier are not built yet. Sections marked TODO are filled in as each part lands.

## Trust model

TODO: expand. The points below must stay in this section.

- A simulated core ledger signs each batch digest, an Ed25519 signature over `(batch_id, merkle_root, record_count)`.
- The proof shows that the private postings hash to the signed `merkle_root` and that the invariants hold. The verifier checks the signature outside the circuit.
- **The demo signing key is public by design.** It is committed in the generator folder, labelled `DEMO ONLY`, so that anyone can reproduce the sample batches. In production the key lives in the core system or an HSM. The browser bundle contains only signed artifacts and the public key.
- The policy limit belongs to the verifier. A bundle with a different limit is rejected.
- No batch data leaves the browser. There are no analytics.

## Try it

TODO: live URL, and the 2-minute path (load a sample, prove, verify, tamper by one cent).

## Develop

Requires Node 22.12 or newer (developed on Node 24).

```bash
npm install      # exact versions are pinned in package.json
npm run dev      # start the Vite dev server
npm test         # run Vitest and fast-check
npm run build    # typecheck and build to dist/
```

## Layout

```
circuits/ledger_audit   Noir circuit (nargo 1.0.0)
src/ledger              batch format, parser, validation
src/zk                  hashing, Merkle tree, proving and verifying
src/ui                  block-mode terminal screens
scripts                 build-time generator and signer (demo key lives here)
public/samples          signed sample batches
tests, e2e              Vitest and fast-check, Playwright
```

See `.kiro/steering/` for the full product, tech and structure notes.

## Tests

TODO: property tests, circuit tests (`nargo test`), end-to-end tests. The log of bugs that property tests caught is in `tests/PBT-LOG.md`.

## Hosting

Static site on Netlify. See `netlify.toml`.

## Built with Kiro

TODO: specs, steering, hooks, MCP, custom agents. Running notes are in `docs/writeup-notes.md`.

## License

MIT. See `LICENSE`.
