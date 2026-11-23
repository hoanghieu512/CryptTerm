// Small file-walk helpers for the terminal-ui scan tests. Read-only, no network. Failure messages
// built from these results hold repo paths only, never file contents.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Every regular file under `dir`, recursively, sorted. Empty when `dir` does not exist. */
export function listFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** Path relative to the repo root, for failure messages. */
export function repoPath(file: string): string {
  return relative(REPO_ROOT, file);
}
