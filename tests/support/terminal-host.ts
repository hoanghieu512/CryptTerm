// A terminal host wired to fakes, for the terminal-ui host tests (design section A, "The effect
// host"). Clipboard, download and open-link record what they receive. The sample loader defaults to
// the committed signed samples through `fakeFetch`. No network, no console, synthetic data only.
import { createSampleLoader } from '../../src/ui/sample-loader';
import { createTerminal } from '../../src/ui/model/terminal';
import type { Terminal, TerminalDeps } from '../../src/ui/model/terminal';
import { initialState } from '../../src/ui/model/update';
import type { TerminalState } from '../../src/ui/model/types';
import { createFakeProve } from './fake-prove';
import type { FakeProve } from './fake-prove';
import { createFakeVerify } from './fake-verify';
import type { FakeVerify } from './fake-verify';
import { fakeFetch } from './terminal-arbitraries';
import type { FakeFetch } from './terminal-arbitraries';

export interface Harness {
  readonly terminal: Terminal;
  readonly fake: FakeProve;
  /** The verifier passed as the `verify` dep (CTM900). It records its calls and settles on demand. */
  readonly verifier: FakeVerify;
  readonly fetcher: FakeFetch;
  readonly clipboard: string[];
  readonly downloads: { filename: string; text: string }[];
  readonly links: string[];
  /** Every href passed to the `navigate` dep (PF3 on CTM900), in order. */
  readonly navigations: string[];
}

export interface HarnessOptions {
  readonly initial?: TerminalState;
  /** The clipboard write rejects with an error that holds a sentinel. */
  readonly clipboardFails?: boolean;
  /** Replaces the default deps, for example a real `ProveService` or a trusted key table. */
  readonly deps?: Partial<TerminalDeps>;
  readonly fetcher?: FakeFetch;
}

export const CLIPBOARD_SENTINEL = 'CLIPBOARD-S3NT1N3L-918273645';

export function makeHarness(options: HarnessOptions = {}): Harness {
  const fake = createFakeProve();
  const verifier = createFakeVerify();
  const fetcher = options.fetcher ?? fakeFetch();
  const clipboard: string[] = [];
  const downloads: { filename: string; text: string }[] = [];
  const links: string[] = [];
  const navigations: string[] = [];
  const deps: TerminalDeps = {
    prove: fake.service,
    loadSample: createSampleLoader(fetcher.fetch),
    writeClipboard: async (text) => {
      clipboard.push(text);
      if (options.clipboardFails === true) throw new Error(CLIPBOARD_SENTINEL);
    },
    download: (filename, text) => {
      downloads.push({ filename, text });
    },
    openLink: (href) => {
      links.push(href);
    },
    navigate: (href) => {
      navigations.push(href);
    },
    verify: verifier.verify,
    ...options.deps,
  };
  const terminal = createTerminal(deps, options.initial ?? initialState());
  return { terminal, fake, verifier, fetcher, clipboard, downloads, links, navigations };
}
