# DEMO ONLY: simulated core-ledger signing key

`DEMO_ONLY_core_ledger_key.json` is the private Ed25519 key of the simulated core ledger. It is public by design: it is committed so that judges can regenerate the signed samples byte for byte. It protects nothing. In production this key lives in the core system or an HSM.

- The browser never signs. It only verifies against the demo public key in `src/ledger/trusted-keys.ts`.
- Tamper mode cannot re-sign. An edited batch fails verification, and the tamper demo depends on that.
- `src/` must never import or read this folder. Test `no_private_key_in_src` enforces it.

## Regenerate the samples

`npm run gen:samples` signs the four sample batches with this key and writes `public/samples/*` and `src/ledger/trusted-keys.ts`. It never creates a key.

## Create the key

`make-demo-key.ts` ran once (`node scripts/demo-key/make-demo-key.ts`). It refuses to overwrite: if the key file exists it writes nothing, prints `DEMO KEY FILE EXISTS` to stderr and exits 1.

## Salts

Sample salts are seeded for demo determinism: seeded salts are not random, so the committed samples are byte-identical on every run; real batches use random salts.
