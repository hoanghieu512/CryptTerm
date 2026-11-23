import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, listFiles, repoPath } from '../support/fs-walk';

// Test playwright_pin (terminal-ui Requirement 10.2, example, one run).
//
// `@playwright/test` is a dev dependency at exactly 1.62.0, with no `^` or `~`, and the lock file
// resolves the same version. No command that downloads a browser (`playwright install`) appears in
// `package.json`, `playwright.config.ts`, `e2e` or `scripts`. The cached Chromium is the only browser.

const PIN = '1.62.0';
const PACKAGE_JSON = join(REPO_ROOT, 'package.json');
const LOCK_FILE = join(REPO_ROOT, 'package-lock.json');
const INSTALL_COMMAND = /\bplaywright(?:-core)?\s+install\b/i;

function readJson(file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('JSON FILE NOT AN OBJECT');
  return parsed as Record<string, unknown>; // checked to be a non-null object just above
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}; // narrowed just above
}

function installCommandFiles(): string[] {
  const files = [
    PACKAGE_JSON,
    join(REPO_ROOT, 'playwright.config.ts'),
    ...listFiles(join(REPO_ROOT, 'e2e')),
    ...listFiles(join(REPO_ROOT, 'scripts')),
  ].filter((file) => existsSync(file));
  return files.filter((file) => INSTALL_COMMAND.test(readFileSync(file, 'utf8'))).map(repoPath);
}

describe('playwright_pin', () => {
  it('playwright_pin: package.json pins @playwright/test at exactly 1.62.0 as a dev dependency', () => {
    const pkg = readJson(PACKAGE_JSON);
    const version = record(pkg['devDependencies'])['@playwright/test'];
    expect(version).toBe(PIN);
    expect(record(pkg['dependencies'])['@playwright/test']).toBeUndefined();
    expect(String(version)).not.toMatch(/[\^~><*xX\s|]/);
  });

  it('playwright_pin: package-lock.json resolves @playwright/test to 1.62.0', () => {
    const lock = readJson(LOCK_FILE);
    const entry = record(record(lock['packages'])['node_modules/@playwright/test']);
    expect(entry['version']).toBe(PIN);
  });

  it('playwright_pin: no playwright install command in package.json, playwright.config.ts, e2e or scripts', () => {
    expect(installCommandFiles()).toEqual([]);
  });

  it('playwright_pin: the install-command pattern fires on the command and not on the package name', () => {
    expect(INSTALL_COMMAND.test('"pw": "playwright install chromium"')).toBe(true);
    expect(INSTALL_COMMAND.test('npx playwright  install')).toBe(true);
    expect(INSTALL_COMMAND.test('"test:e2e": "playwright test"')).toBe(false);
    expect(INSTALL_COMMAND.test('"@playwright/test": "1.62.0"')).toBe(false);
    expect(INSTALL_COMMAND.test('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install')).toBe(false);
  });
});
