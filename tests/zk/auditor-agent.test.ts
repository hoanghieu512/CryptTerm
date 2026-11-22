import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Feature: zk-core, Requirement 11. `auditor_agent_config` checks the agent file. Then
// `auditor_notes_recorded` checks that the one run is written up in docs/writeup-notes.md.

const root = (path: string): string => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const AGENT_PATH = root('.kiro/agents/circuit-auditor.json');
const NOTES_PATH = root('docs/writeup-notes.md');
const GITIGNORE_PATH = root('.gitignore');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAgent(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(AGENT_PATH, 'utf8'));
  if (!isRecord(parsed)) throw new Error('AGENT FILE IS NOT AN OBJECT');
  return parsed;
}

// Selectors that would give the agent a way to change files or run commands.
const FORBIDDEN_TOOLS: readonly string[] = [
  'write', 'shell', 'web', 'subagent', '*', '@builtin', '@mcp',
  'fs_write', 'fs_append', 'str_replace', 'delete_file', 'execute_bash',
];

describe('auditor_agent_config', () => {
  it('auditor_agent_config: read-only tool list', () => {
    const agent = readAgent();
    expect(agent['name']).toBe('circuit-auditor');
    const tools = agent['tools'];
    expect(Array.isArray(tools)).toBe(true);
    const names = (tools as unknown[]).map(String);
    expect(names).toContain('read');
    for (const forbidden of FORBIDDEN_TOOLS) {
      expect(names).not.toContain(forbidden);
    }
    expect(agent['includeMcpJson']).not.toBe(true);
  });

  it('auditor_agent_config: writes and shell are denied by permissions', () => {
    const permissions = readAgent()['permissions'];
    if (!isRecord(permissions)) throw new Error('PERMISSIONS MISSING');
    const rules = JSON.stringify(permissions['rules']);
    const wanted = ['"capability":"fs_write"', '"capability":"shell"', '"effect":"deny"'];
    for (const piece of wanted) {
      expect(rules).toContain(piece);
    }
  });
});

// Requirement 11.1: the prompt covers Noir soundness and TypeScript to circuit parity.
const PROMPT_TOPICS: readonly string[] = [
  'unconstrained',
  'range check before comparison',
  'padding binding',
  'explicit boolean',
  'public inputs',
  'hash variant',
  'field encoding',
  'leaf order',
  'padding rule',
];

describe('auditor_agent_config prompt and tracking', () => {
  it('auditor_agent_config: the prompt names the topics and the scope', () => {
    const prompt = String(readAgent()['prompt']).toLowerCase();
    for (const topic of PROMPT_TOPICS) {
      expect(prompt).toContain(topic);
    }
    for (const scoped of ['circuits/ledger_audit', 'src/zk/witness-builder.ts', 'src/zk/batch-root.ts']) {
      expect(prompt).toContain(scoped);
    }
    expect(prompt).toContain('scripts/');
    expect(prompt).toContain('public/samples/');
  });

  it('auditor_agent_config: .gitignore does not exclude .kiro/agents', () => {
    const ignored = readFileSync(GITIGNORE_PATH, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    const hits = ignored.filter((line) => /^\/?\.kiro(\/|$)/.test(line) || line.includes('agents'));
    expect(hits).toEqual([]);
  });
});

// The write-up entry for the one auditor run: a section headed "Circuit auditor".
function auditorSection(): string {
  const notes = readFileSync(NOTES_PATH, 'utf8');
  const start = notes.search(/^###? .*Circuit auditor/m);
  if (start < 0) return '';
  const rest = notes.slice(notes.indexOf('\n', start) + 1);
  const next = rest.search(/^###? /m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('auditor_notes_recorded', () => {
  it('auditor_notes_recorded: the entry names the files, the command and the date', () => {
    const section = auditorSection();
    expect(section).not.toBe('');
    for (const scoped of ['circuits/ledger_audit', 'src/zk/witness-builder.ts', 'src/zk/batch-root.ts']) {
      expect(section).toContain(scoped);
    }
    expect(section).toMatch(/kiro-cli chat/);
    expect(section).toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(section).toMatch(/Findings/);
  });
});
