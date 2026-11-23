// Scanner for a build output folder (terminal-ui Requirement 10.8). The `dist` folder may hold no
// file from `e2e`, `tests` or `scripts`, no file named after the Demo_Key file, and no Demo_Key
// private bytes. Read-only. Findings are repo-relative paths and rule names, never the key value.
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { listFiles } from './fs-walk';

export const KEY_FILE_NAME = 'DEMO_ONLY_core_ledger_key';

export interface KeyNeedles {
  readonly dBase64Url: string;
  readonly dHex: string;
  readonly dBytes: Buffer;
}

/** Reads the Demo_Key private value from its JWK text. Throws a fixed message and shows no value. */
export function keyNeedlesFromJwk(jwkText: string): KeyNeedles {
  const parsed: unknown = JSON.parse(jwkText);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('TEST KEY FILE NOT AN OBJECT');
  const d = (parsed as Record<string, unknown>)['d']; // checked to be a non-null object just above
  if (typeof d !== 'string') throw new Error('TEST KEY FILE LACKS d');
  const dBytes = Buffer.from(d, 'base64url');
  if (dBytes.length !== 32) throw new Error('TEST KEY FILE WRONG LENGTH');
  return { dBase64Url: d, dHex: dBytes.toString('hex'), dBytes };
}

const FORBIDDEN_FOLDERS: readonly string[] = ['tests', 'scripts'];

/** Findings for every file under `distDir`, as `<relative path> <rule>`. Empty when clean. */
export function findDistLeaks(distDir: string, key: KeyNeedles): string[] {
  const findings: string[] = [];
  for (const file of listFiles(distDir)) {
    const rel = relative(distDir, file);
    const parts = rel.split(sep);
    if (parts.some((part) => part.includes('e2e'))) findings.push(`${rel} e2e`);
    if (parts.slice(0, -1).some((part) => FORBIDDEN_FOLDERS.includes(part))) findings.push(`${rel} source folder`);
    if (parts.some((part) => part.includes(KEY_FILE_NAME))) findings.push(`${rel} key file name`);
    const bytes = readFileSync(file);
    // latin1 keeps every byte one character, so ASCII needles are found in binary files too.
    const text = bytes.toString('latin1');
    if (text.includes(KEY_FILE_NAME)) findings.push(`${rel} key file name in content`);
    if (text.includes(key.dBase64Url) || text.toLowerCase().includes(key.dHex) || bytes.includes(key.dBytes)) {
      findings.push(`${rel} key bytes`);
    }
  }
  return findings;
}
