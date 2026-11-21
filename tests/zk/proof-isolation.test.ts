import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirement 6.1 (the proof tests run separately from the default run). This is the guard test of
// design.md "Test split: default run and proof run". It runs under `npm test`.
//
// Each rule is a pure function over file paths, file texts or the parsed manifest, so the
// negative controls run the same function on mutated in-memory inputs. No repo file is modified.
// The test reads files from disk only. It never touches the network and prints nothing.

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Repo-relative POSIX path of this file. It holds the search patterns, so rule (1) skips it. */
const SELF_PATH = 'tests/zk/proof-isolation.test.ts';
const PROOF_DIR = 'tests/zk/proof/';
const ZK_ENV_PATH = 'tests/support/zk-env.ts';
const FORBIDDEN_EVERYWHERE: readonly string[] = ['circuitProve', 'circuitVerify', 'UltraHonkBackend'];
const PROVER_ENV_NAME = 'createProverEnv';
const VITE_EXCLUDE_GLOB = 'tests/zk/proof/**';
const EXPECTED_TEST_SCRIPT = 'vitest run';
const EXPECTED_PROOF_CONFIG_FLAG = '--config vitest.proof.config.ts';
const PROOF_CONFIG_PATH = 'vitest.proof.config.ts';
const FAST_CHECK_IMPORT = /['"]fast-check['"]/;

interface SourceFile {
  /** Repo-relative POSIX path, for example `tests/zk/foo.test.ts`. */
  readonly path: string;
  readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rule 1: proof-only names stay inside `tests/zk/proof/`. */
function checkProofNamesIsolated(files: readonly SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (file.path === SELF_PATH || file.path.startsWith(PROOF_DIR)) continue;
    for (const name of FORBIDDEN_EVERYWHERE) {
      if (file.text.includes(name)) violations.push(`${file.path}: contains ${name}`);
    }
    if (file.path !== ZK_ENV_PATH && file.text.includes(PROVER_ENV_NAME)) {
      violations.push(`${file.path}: contains ${PROVER_ENV_NAME}`);
    }
  }
  return violations;
}

/** Rule 2: file names under `tests/zk/proof/`. */
function checkProofFileNames(files: readonly SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (!file.path.startsWith(PROOF_DIR)) continue;
    if (!file.path.endsWith('.test.ts')) {
      violations.push(`${file.path}: does not end in .test.ts`);
    } else if (FAST_CHECK_IMPORT.test(file.text) && !file.path.endsWith('.prop.test.ts')) {
      violations.push(`${file.path}: imports fast-check but does not end in .prop.test.ts`);
    }
  }
  return violations;
}

/** Rule 3: the default config excludes the proof directory. `undefined` means the file is missing. */
function checkViteExclude(viteConfigText: string | undefined): string[] {
  if (viteConfigText === undefined) return ['vite.config.ts: missing'];
  return viteConfigText.includes(VITE_EXCLUDE_GLOB)
    ? []
    : [`vite.config.ts: does not contain ${VITE_EXCLUDE_GLOB}`];
}

/** Rule 4: the npm scripts. `undefined` means the file is missing. */
function checkScripts(packageJsonText: string | undefined): string[] {
  if (packageJsonText === undefined) return ['package.json: missing'];
  let manifest: unknown;
  try {
    manifest = JSON.parse(packageJsonText);
  } catch {
    return ['package.json: not valid JSON'];
  }
  const scripts = isRecord(manifest) ? manifest['scripts'] : undefined;
  if (!isRecord(scripts)) return ['package.json: no scripts object'];
  const violations: string[] = [];
  const testScript = scripts['test'];
  if (testScript !== EXPECTED_TEST_SCRIPT) {
    violations.push(`package.json: test script is not exactly "${EXPECTED_TEST_SCRIPT}"`);
  }
  const proofScript = scripts['test:proof'];
  if (typeof proofScript !== 'string') {
    violations.push('package.json: no test:proof script');
  } else if (!proofScript.includes(EXPECTED_PROOF_CONFIG_FLAG)) {
    violations.push(`package.json: test:proof does not contain ${EXPECTED_PROOF_CONFIG_FLAG}`);
  }
  return violations;
}

/** Rule 5: the proof config exists. `undefined` means the file is missing. */
function checkProofConfigPresent(proofConfigText: string | undefined): string[] {
  return proofConfigText === undefined ? [`${PROOF_CONFIG_PATH}: missing`] : [];
}

function walkTsFiles(dirAbsolute: string, dirRelative: string, out: SourceFile[]): void {
  for (const entry of readdirSync(dirAbsolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const absolute = `${dirAbsolute}/${entry.name}`;
    const relative = `${dirRelative}/${entry.name}`;
    if (entry.isDirectory()) {
      walkTsFiles(absolute, relative, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push({ path: relative, text: readFileSync(absolute, 'utf8') });
    }
  }
}

function readIfPresent(relativePath: string): string | undefined {
  const absolute = `${REPO_ROOT}${relativePath}`;
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : undefined;
}

const GOOD_PACKAGE_JSON = JSON.stringify({
  scripts: { test: 'vitest run', 'test:proof': 'vitest run --config vitest.proof.config.ts' },
});

describe('proof isolation: real repo', () => {
  const testFiles: SourceFile[] = [];
  walkTsFiles(`${REPO_ROOT}tests`, 'tests', testFiles);

  it('scans the test files (sanity: the walk finds this file and the proof smoke test)', () => {
    const paths = testFiles.map((file) => file.path);
    expect(paths).toContain(SELF_PATH);
    expect(paths).toContain('tests/zk/proof/proof-smoke.test.ts');
    expect(paths).toContain(ZK_ENV_PATH);
  });

  it('rule 1: proof-only names appear only under tests/zk/proof/ (and createProverEnv in zk-env.ts)', () => {
    expect(checkProofNamesIsolated(testFiles)).toEqual([]);
  });

  it('rule 2: files under tests/zk/proof/ are named correctly', () => {
    expect(checkProofFileNames(testFiles)).toEqual([]);
  });

  it('rule 2 detail: the real proof smoke test does not import fast-check', () => {
    const smoke = testFiles.find((file) => file.path === 'tests/zk/proof/proof-smoke.test.ts');
    expect(smoke).toBeDefined();
    expect(FAST_CHECK_IMPORT.test(smoke?.text ?? '')).toBe(false);
  });

  it('rule 3: vite.config.ts excludes tests/zk/proof/**', () => {
    expect(checkViteExclude(readIfPresent('vite.config.ts'))).toEqual([]);
  });

  it('rule 4: package.json scripts test and test:proof are as required', () => {
    expect(checkScripts(readIfPresent('package.json'))).toEqual([]);
  });

  it('rule 5: vitest.proof.config.ts exists', () => {
    expect(checkProofConfigPresent(readIfPresent(PROOF_CONFIG_PATH))).toEqual([]);
  });
});

describe('proof isolation: negative controls (in-memory mutants)', () => {
  it('rule 1 rejects circuitProve, circuitVerify and UltraHonkBackend outside the proof dir', () => {
    for (const name of FORBIDDEN_EVERYWHERE) {
      const files: SourceFile[] = [{ path: 'tests/zk/foo.test.ts', text: `await ${name}(x);` }];
      expect(checkProofNamesIsolated(files)).toHaveLength(1);
    }
  });

  it('rule 1 rejects them in tests/support too, even in zk-env.ts', () => {
    const files: SourceFile[] = [{ path: ZK_ENV_PATH, text: 'new UltraHonkBackend()' }];
    expect(checkProofNamesIsolated(files)).toHaveLength(1);
  });

  it('rule 1 rejects createProverEnv outside zk-env.ts but accepts it inside', () => {
    const text = 'const env = await createProverEnv();';
    expect(checkProofNamesIsolated([{ path: 'tests/zk/bar.test.ts', text }])).toHaveLength(1);
    expect(checkProofNamesIsolated([{ path: ZK_ENV_PATH, text }])).toEqual([]);
  });

  it('rule 1 accepts the same text under tests/zk/proof/', () => {
    const text = 'circuitProve(); createProverEnv(); new UltraHonkBackend();';
    expect(checkProofNamesIsolated([{ path: 'tests/zk/proof/ok.test.ts', text }])).toEqual([]);
  });

  it('rule 2 rejects a file under tests/zk/proof/ that does not end in .test.ts', () => {
    const files: SourceFile[] = [{ path: 'tests/zk/proof/x.ts', text: 'export const a = 1;' }];
    expect(checkProofFileNames(files)).toHaveLength(1);
  });

  it('rule 2 rejects a fast-check import in a .test.ts file and accepts it in .prop.test.ts', () => {
    const text = "import fc from 'fast-check';";
    expect(checkProofFileNames([{ path: 'tests/zk/proof/y.test.ts', text }])).toHaveLength(1);
    expect(checkProofFileNames([{ path: 'tests/zk/proof/y.prop.test.ts', text }])).toEqual([]);
  });

  it('rule 2 ignores files outside tests/zk/proof/', () => {
    const files: SourceFile[] = [{ path: 'tests/zk/z.ts', text: "import fc from 'fast-check';" }];
    expect(checkProofFileNames(files)).toEqual([]);
  });

  it('rule 3 rejects a vite config without the exclude, and a missing one', () => {
    const without = "export default { test: { exclude: ['node_modules'] } };";
    expect(checkViteExclude(without)).toHaveLength(1);
    expect(checkViteExclude(undefined)).toHaveLength(1);
    expect(checkViteExclude(`exclude: ['${VITE_EXCLUDE_GLOB}']`)).toEqual([]);
  });

  it('rule 4 accepts the good manifest', () => {
    expect(checkScripts(GOOD_PACKAGE_JSON)).toEqual([]);
  });

  it('rule 4 rejects a manifest with no test:proof script', () => {
    const text = JSON.stringify({ scripts: { test: 'vitest run' } });
    expect(checkScripts(text)).toHaveLength(1);
  });

  it('rule 4 rejects a test script that is not exactly "vitest run"', () => {
    const variants = ['vitest', 'vitest run ', 'vitest run --config vitest.proof.config.ts'];
    for (const testScript of variants) {
      const text = JSON.stringify({
        scripts: { test: testScript, 'test:proof': 'vitest run --config vitest.proof.config.ts' },
      });
      expect(checkScripts(text)).toHaveLength(1);
    }
  });

  it('rule 4 rejects a test:proof script without --config vitest.proof.config.ts', () => {
    const text = JSON.stringify({ scripts: { test: 'vitest run', 'test:proof': 'vitest run' } });
    expect(checkScripts(text)).toHaveLength(1);
  });

  it('rule 4 rejects a missing, malformed or script-less package.json', () => {
    expect(checkScripts(undefined)).toHaveLength(1);
    expect(checkScripts('{not json')).toHaveLength(1);
    expect(checkScripts('{}')).toHaveLength(1);
  });

  it('rule 5 rejects a missing proof config and accepts a present one', () => {
    expect(checkProofConfigPresent(undefined)).toHaveLength(1);
    expect(checkProofConfigPresent('export default {};')).toEqual([]);
  });
});
