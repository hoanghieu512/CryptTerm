// The browser backend of the proof worker (zk-core design section C).
//
// It loads every asset from the page origin through the existing loaders: the Artifact, the SRS,
// the two noir WASM files and the shipped verification key. No Node test imports this file,
// because its `?url` imports are for Vite. bb.js runs single-threaded WASM on the worker thread,
// with no SharedArrayBuffer and no COOP/COEP headers.
import initAcvm from '@noir-lang/acvm_js';
import acvmWasmUrl from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url&no-inline';
import { Noir } from '@noir-lang/noir_js';
import initAbi from '@noir-lang/noirc_abi';
import abiWasmUrl from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url&no-inline';
import type { Barretenberg } from '@aztec-foundation/bb.js';
import { ARTIFACT_URL, VK_URL, loadArtifactFromUrl, loadVkFromUrl } from './artifact';
import { assertShippedVk } from './circuit-vk';
import { createHasher } from './hash';
import { acirBytes, createBb, executeCircuit, proveCircuit, verifyProofWithVk } from './prover';
import { fetchSrsSource, loadSrs } from './srs';
import { SRS_MANIFEST, SRS_URLS } from './srs-assets';
import type { ProverSession, VerifierSession, WorkerBackend } from './worker-core';

// The two noir WASM modules from same-origin URLs. Both calls are safe to repeat.
async function initNoirWasm(): Promise<void> {
  await Promise.all([initAcvm({ module_or_path: acvmWasmUrl }), initAbi({ module_or_path: abiWasmUrl })]);
}

const loadSrsFromOrigin = () => loadSrs(fetchSrsSource(SRS_URLS), SRS_MANIFEST);

async function openProver(): Promise<ProverSession> {
  const [artifact, srs] = await Promise.all([loadArtifactFromUrl(ARTIFACT_URL), loadSrsFromOrigin()]);
  await initNoirWasm();
  const bb: Barretenberg = await createBb(srs);
  try {
    const acir = await acirBytes(artifact);
    const noir = new Noir(artifact);
    return {
      hasher: createHasher(bb),
      execute: async (inputs) => (await executeCircuit(noir, inputs)).witness,
      prove: async (witness) => {
        const { proof, publicInputs } = await proveCircuit(bb, acir, witness);
        return { proof, publicInputs };
      },
      close: () => bb.destroy(),
    };
  } catch (error) {
    await bb.destroy();
    throw error;
  }
}

// The shipped key is loaded and checked before it is used. The Artifact and noir WASM are not needed.
async function openVerifier(): Promise<VerifierSession> {
  const bb: Barretenberg = await createBb(await loadSrsFromOrigin());
  try {
    const vk = await loadVkFromUrl(VK_URL);
    await assertShippedVk(vk);
    return {
      verify: (proof, publicInputs) => verifyProofWithVk(bb, vk, publicInputs, proof),
      close: () => bb.destroy(),
    };
  } catch (error) {
    await bb.destroy();
    throw error;
  }
}

export function createBrowserBackend(): WorkerBackend {
  return { openProver, openVerifier };
}
