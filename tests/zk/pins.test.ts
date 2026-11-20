import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Requirements 1.4 and 1.7: the five toolchain packages are pinned to exact versions
// and the superseded @aztec/bb.js package is absent.

const REQUIRED_PINS: Readonly<Record<string, string>> = {
  '@noir-lang/noir_js': '1.0.0',
  '@noir-lang/acvm_js': '1.0.0',
  '@noir-lang/noirc_abi': '1.0.0',
  '@noir-lang/types': '1.0.0',
  '@aztec-foundation/bb.js': '6.0.0',
};

const FORBIDDEN_PACKAGE = '@aztec/bb.js';
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns one message per violated pin rule. An empty list means the manifest is valid. */
function validatePins(manifest: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(manifest)) {
    return ['manifest is not an object'];
  }
  const dependencies = isRecord(manifest['dependencies']) ? manifest['dependencies'] : {};
  const devDependencies = isRecord(manifest['devDependencies']) ? manifest['devDependencies'] : {};

  for (const [name, required] of Object.entries(REQUIRED_PINS)) {
    const pin: unknown = dependencies[name];
    if (typeof pin !== 'string') {
      problems.push(`${name}: missing from dependencies`);
    } else if (!EXACT_VERSION.test(pin)) {
      problems.push(`${name}: not an exact version`);
    } else if (pin !== required) {
      problems.push(`${name}: expected ${required}`);
    }
  }
  if (FORBIDDEN_PACKAGE in dependencies) {
    problems.push(`${FORBIDDEN_PACKAGE}: present in dependencies`);
  }
  if (FORBIDDEN_PACKAGE in devDependencies) {
    problems.push(`${FORBIDDEN_PACKAGE}: present in devDependencies`);
  }
  return problems;
}

function validManifest(): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  return { dependencies: { ...REQUIRED_PINS }, devDependencies: {} };
}

describe('toolchain pins in package.json', () => {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  );

  it('has every pin as an exact x.y.z version', () => {
    const dependencies =
      isRecord(manifest) && isRecord(manifest['dependencies']) ? manifest['dependencies'] : {};
    for (const name of Object.keys(REQUIRED_PINS)) {
      expect(dependencies[name], name).toMatch(EXACT_VERSION);
    }
  });

  it('has every pin equal to the required version', () => {
    const dependencies =
      isRecord(manifest) && isRecord(manifest['dependencies']) ? manifest['dependencies'] : {};
    for (const [name, required] of Object.entries(REQUIRED_PINS)) {
      expect(dependencies[name], name).toBe(required);
    }
  });

  it('lists @aztec/bb.js in neither dependencies nor devDependencies', () => {
    expect(isRecord(manifest)).toBe(true);
    const dependencies =
      isRecord(manifest) && isRecord(manifest['dependencies']) ? manifest['dependencies'] : {};
    const devDependencies =
      isRecord(manifest) && isRecord(manifest['devDependencies']) ? manifest['devDependencies'] : {};
    expect(FORBIDDEN_PACKAGE in dependencies).toBe(false);
    expect(FORBIDDEN_PACKAGE in devDependencies).toBe(false);
  });

  it('passes the validation function as a whole', () => {
    expect(validatePins(manifest)).toEqual([]);
  });
});

describe('pin validation rejects mutated manifests', () => {
  it('accepts the reference manifest', () => {
    expect(validatePins(validManifest())).toEqual([]);
  });

  const mutations: ReadonlyArray<readonly [string, (m: ReturnType<typeof validManifest>) => void]> = [
    ['caret range', (m) => { m.dependencies['@noir-lang/noir_js'] = '^1.0.0'; }],
    ['tilde range', (m) => { m.dependencies['@noir-lang/acvm_js'] = '~1.0.0'; }],
    ['wrong patch version', (m) => { m.dependencies['@noir-lang/noirc_abi'] = '1.0.1'; }],
    ['latest tag', (m) => { m.dependencies['@noir-lang/types'] = 'latest'; }],
    ['bb.js newer version', (m) => { m.dependencies['@aztec-foundation/bb.js'] = '6.1.0'; }],
    ['missing key', (m) => { delete m.dependencies['@aztec-foundation/bb.js']; }],
    ['@aztec/bb.js in dependencies', (m) => { m.dependencies['@aztec/bb.js'] = '6.0.0'; }],
    ['@aztec/bb.js in devDependencies', (m) => { m.devDependencies['@aztec/bb.js'] = '6.0.0'; }],
  ];

  for (const [label, mutate] of mutations) {
    it(`rejects: ${label}`, () => {
      const manifest = validManifest();
      mutate(manifest);
      expect(validatePins(manifest).length).toBeGreaterThan(0);
    });
  }

  it('rejects a manifest that is not an object', () => {
    expect(validatePins(null)).not.toEqual([]);
    expect(validatePins([])).not.toEqual([]);
  });
});
