import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../support/fs-walk';

// Tests readme_sections, readme_commands, readme_versions and readme_kiro_section (release
// Requirement 5.1 to 5.5, examples). They read README.md, package.json and the product steering file.
const README = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
const PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  readonly scripts: Record<string, string>;
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
};
const PRODUCT = readFileSync(join(REPO_ROOT, '.kiro', 'steering', 'product.md'), 'utf8');

const SECTION_TITLES: readonly string[] = [
  'What CryptTerm is',
  'Trust model',
  'The two tamper cases',
  'Run locally',
  'Regenerate samples and circuit identity',
  'Stack and versions',
  'How Kiro was used',
  'License',
];

/** The text of one second-level section, without its heading line. */
function sectionBody(title: string): string[] {
  const lines = README.split('\n');
  const start = lines.findIndex((line) => line === `## ${title}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

/** The bullet lines of the product steering file's trust-model section. */
function productTrustBullets(): string[] {
  const start = PRODUCT.indexOf('\n## Trust model');
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = PRODUCT.slice(start + 1);
  const next = rest.indexOf('\n## ', 1);
  const section = next === -1 ? rest : rest.slice(0, next);
  return section.split('\n').filter((line) => line.startsWith('- '));
}

describe('README', () => {
  it('readme_sections: second-level headings are the required list in order, and the trust model keeps its bullets', () => {
    const headings = README.split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3));
    expect(headings).toEqual([...SECTION_TITLES]);

    const trust = sectionBody('Trust model').join('\n');
    const bullets = productTrustBullets();
    expect(bullets.length).toBeGreaterThan(0);
    for (const bullet of bullets) expect(trust).toContain(bullet);
    expect(trust).toContain('DEMO ONLY');
    expect(trust).toContain('public by design');
  });

  it('readme_commands: run-locally and regenerate sections list the commands, and each script exists', () => {
    const run = sectionBody('Run locally').join('\n');
    expect(run).toContain('npm ci');
    expect(run).toContain('nargo 1.0.0');
    expect(run).toContain('npm test');
    expect(PACKAGE.scripts['test']).toBeDefined();
    for (const script of ['dev', 'test:circuit', 'test:proof', 'test:e2e']) {
      expect(run).toContain(`npm run ${script}`);
      expect(PACKAGE.scripts[script]).toBeDefined();
    }

    const regenerate = sectionBody('Regenerate samples and circuit identity').join('\n');
    for (const script of ['gen:samples', 'gen:identity']) {
      expect(regenerate).toContain(`npm run ${script}`);
      expect(PACKAGE.scripts[script]).toBeDefined();
    }
  });

  it('readme_versions: every dependency and devDependency of package.json appears with its exact version', () => {
    const stack = sectionBody('Stack and versions').join('\n');
    const all = { ...PACKAGE.dependencies, ...PACKAGE.devDependencies };
    expect(Object.keys(all).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(all)) {
      expect(stack, `${name} ${version}`).toContain(`- \`${name}\` ${version}\n`);
    }
  });

  it('readme_kiro_section: at most 15 lines, and it names the specs, steering, hook, agent, property tests and PBT log', () => {
    const body = sectionBody('How Kiro was used');
    while (body.length > 0 && body[body.length - 1]?.trim() === '') body.pop();
    expect(body.length).toBeLessThanOrEqual(15);
    const text = body.join('\n');
    const named: readonly string[] = [
      '.kiro/specs/',
      '.kiro/steering/',
      'ledger-save',
      'circuit-auditor',
      'property tests',
      'tests/PBT-LOG.md',
    ];
    for (const name of named) expect(text).toContain(name);
    // Every spec, steering file, hook and agent the section names exists on disk.
    for (const spec of ['zk-spike', 'ledger-format', 'zk-core', 'verifier', 'terminal-ui', 'release']) {
      expect(text).toContain(spec);
      expect(existsSync(join(REPO_ROOT, '.kiro', 'specs', spec))).toBe(true);
    }
    for (const file of ['product.md', 'tech.md', 'structure.md', 'security.md', 'noir.md']) {
      expect(text).toContain(file);
      expect(existsSync(join(REPO_ROOT, '.kiro', 'steering', file))).toBe(true);
    }
    expect(existsSync(join(REPO_ROOT, '.kiro', 'hooks', 'ledger-save.json'))).toBe(true);
    expect(existsSync(join(REPO_ROOT, '.kiro', 'agents', 'circuit-auditor.json'))).toBe(true);
    expect(existsSync(join(REPO_ROOT, 'tests', 'PBT-LOG.md'))).toBe(true);
  });
});
