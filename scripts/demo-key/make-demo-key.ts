// DEMO ONLY. One-off script, run by hand once. The key it writes is public by design.
//
// Creates the demo core-ledger Ed25519 key pair and writes the private JWK to
// `DEMO_ONLY_core_ledger_key.json` next to this file. Run with: node scripts/demo-key/make-demo-key.ts
//
// It never overwrites: if the key file exists it writes nothing, prints `DEMO KEY FILE EXISTS`
// to stderr and exits 1. scripts/gen-samples.ts never calls this script and never creates a key.
// Plain Node: no import from the repo, only node:fs, node:path, node:url and the global crypto.subtle.
// It prints no key material.

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY_FILE = join(dirname(fileURLToPath(import.meta.url)), 'DEMO_ONLY_core_ledger_key.json');

async function main(): Promise<number> {
  if (existsSync(KEY_FILE)) {
    process.stderr.write('DEMO KEY FILE EXISTS\n');
    return 1;
  }

  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const exported = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (exported.kty !== 'OKP' || exported.crv !== 'Ed25519' || typeof exported.x !== 'string' || typeof exported.d !== 'string') {
    process.stderr.write('DEMO KEY EXPORT UNEXPECTED\n');
    return 1;
  }

  // Fixed key order; key_ops, ext and alg are dropped.
  const jwk = { kty: 'OKP', crv: 'Ed25519', x: exported.x, d: exported.d };
  // Flag 'wx' fails if the file appeared since the check above, so an existing key is never replaced.
  writeFileSync(KEY_FILE, `${JSON.stringify(jwk, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write('DEMO KEY FILE WRITTEN\n');
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.stderr.write('DEMO KEY CREATION FAILED\n');
    process.exitCode = 1;
  },
);
