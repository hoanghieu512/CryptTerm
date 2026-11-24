// Types of the terminal model (terminal-ui design, section A). Types only: no runtime code.
import type { Batch } from '../../ledger/batch';
import type { SignedDigest } from '../../ledger/digest';
import type { Cents } from '../../ledger/posting';
import type { ProofBundle } from '../../zk/bundle';
import type { ProveReason } from '../../zk/prove-service';
import type { ProveStage } from '../../zk/worker-protocol';
import type { SampleName } from './samples';

/** `samples.ts` owns the name. Re-exported here so model code can take every type from one place. */
export type { SampleName } from './samples';

export type ScreenId = 'CTM000' | 'CTM100' | 'CTM200' | 'CTM300' | 'CTM900';
export type PfNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/** `amt:<slot>`: slot is the 0-based posting index. */
export type FieldId = 'select' | 'limit' | `amt:${number}`;

export interface LoadedSample {
  readonly name: SampleName;
  /** As parsed, never changed. */
  readonly batch: Batch;
  /** Original_Digest, frozen, never replaced. */
  readonly digest: SignedDigest;
  /** `checkSignature` result, computed once at load. */
  readonly signatureValid: boolean;
}

export interface Cursor {
  readonly fieldId: FieldId;
  readonly offset: number;
}

export type ProveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'proving'; readonly runId: number; readonly stage: ProveStage }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'done'; readonly bundle: ProofBundle; readonly json: string; readonly link: string };

/** Where the Bundle_Text came from. `NONE` when no bundle was supplied. */
export type BundleSource = 'NONE' | 'LINK' | 'PASTE' | 'FILE';

/**
 * What a drop hands over. `File` satisfies it. The model reads `name` and `size` only and never
 * calls `text()`: the host calls it after the model emitted READ_FILE.
 */
export interface DroppedFile {
  readonly name: string;
  /** Bytes, from `File.size`. */
  readonly size: number;
  text(): Promise<string>;
}

export interface VerifyRun {
  readonly runId: number;
  /** The limit field text when the run started. */
  readonly limitText: string;
  /** The bundle version when the run started. */
  readonly bundleSeq: number;
}

export type VerifyOutcome =
  | { readonly kind: 'report'; readonly passed: number; readonly keyId: string | null }
  | { readonly kind: 'error' };

export interface VerifyState {
  /** The one copy of the Bundle_Text. Never drawn, never copied into any other field. */
  readonly bundleText: string;
  readonly source: BundleSource;
  /** 0 at start (1 for a link), +1 on every replacement of `bundleText`. */
  readonly bundleSeq: number;
  /** Id of the file read in flight, from `nextLoadId`. */
  readonly pendingRead: number | null;
  readonly run: VerifyRun | null;
  readonly result: { readonly outcome: VerifyOutcome; readonly limitText: string; readonly bundleSeq: number } | null;
}

export interface TerminalState {
  readonly screen: ScreenId;
  /** Text of every input Field. */
  readonly fields: Readonly<Partial<Record<FieldId, string>>>;
  /** Null when the screen has no input Field. */
  readonly cursor: Cursor | null;
  /** Row 24 text, from MESSAGES only. */
  readonly status: string;
  readonly sample: LoadedSample | null;
  /** Slot to amount, only for slots that differ from the sample. */
  readonly edits: ReadonlyMap<number, Cents>;
  /** CTM200 Tamper_Mode. */
  readonly tamper: boolean;
  /** CTM200 page index, 0-based. */
  readonly page: number;
  /** Id of the sample load in flight. */
  readonly pendingLoad: number | null;
  readonly prove: ProveState;
  /** CTM900 bundle input and run state. */
  readonly verify: VerifyState;
  /** Monotonic, never reset. */
  readonly nextLoadId: number;
  /** Monotonic, never reset. */
  readonly nextRunId: number;
}

// Layout. Rows and columns are 1-based.
export type Field =
  | { readonly kind: 'text'; readonly protected: true; readonly row: number; readonly col: number; readonly text: string }
  | {
      readonly kind: 'input';
      readonly protected: false;
      readonly id: FieldId;
      readonly row: number;
      readonly col: number;
      readonly length: number;
    };

export interface Update {
  readonly state: TerminalState;
  readonly effects: readonly Effect[];
}

export interface PfEntry {
  readonly pf: PfNumber;
  readonly label: string;
  run(state: TerminalState): Update;
}

export interface ScreenLayout {
  readonly fields: readonly Field[];
  readonly pf: readonly PfEntry[];
}

export interface ScreenDef {
  layout(state: TerminalState): ScreenLayout;
  /** Enter: the text of all input fields of the screen, keyed by field id. */
  submit(state: TerminalState, values: Readonly<Record<string, string>>): Update;
}

// Actions.
export type UserAction =
  | { readonly type: 'PF'; readonly pf: PfNumber }
  | { readonly type: 'ENTER' }
  | { readonly type: 'TAB'; readonly back: boolean }
  | { readonly type: 'BACKSPACE' }
  | { readonly type: 'CHAR'; readonly ch: string };

export type SystemAction =
  | { readonly type: 'SAMPLE_LOADED'; readonly loadId: number; readonly sample: LoadedSample }
  | { readonly type: 'SAMPLE_FAILED'; readonly loadId: number }
  | { readonly type: 'PROVE_PROGRESS'; readonly runId: number; readonly stage: string }
  | { readonly type: 'PROVE_DONE'; readonly runId: number; readonly bundle: ProofBundle }
  | { readonly type: 'PROVE_FAILED'; readonly runId: number; readonly reason: ProveReason | 'UNEXPECTED' }
  | { readonly type: 'CLIPBOARD_DONE'; readonly ok: boolean }
  | { readonly type: 'PASTE_TEXT'; readonly text: string }
  | { readonly type: 'FILES_DROPPED'; readonly files: readonly DroppedFile[] }
  | { readonly type: 'FILE_READ'; readonly readId: number; readonly text: string }
  | { readonly type: 'FILE_READ_FAILED'; readonly readId: number }
  /** `report` is whatever the verifier resolved with: `normalizeReport` decides what it is. */
  | { readonly type: 'VERIFY_DONE'; readonly runId: number; readonly report: unknown; readonly keyId: string | null }
  | { readonly type: 'VERIFY_FAILED'; readonly runId: number };

export type Action = UserAction | SystemAction;

// Effects. Plain data: the host runs them.
export type Effect =
  | { readonly type: 'LOAD_SAMPLE'; readonly loadId: number; readonly name: SampleName }
  | {
      readonly type: 'PROVE';
      readonly runId: number;
      readonly batch: Batch;
      readonly digest: SignedDigest;
      readonly limitCents: Cents;
    }
  | { readonly type: 'CANCEL_PROVE' }
  | { readonly type: 'CLIPBOARD_WRITE'; readonly text: string }
  | { readonly type: 'DOWNLOAD'; readonly filename: string; readonly text: string }
  | { readonly type: 'OPEN_LINK'; readonly href: string }
  | { readonly type: 'VERIFY'; readonly runId: number; readonly text: string; readonly limitCents: Cents }
  | { readonly type: 'READ_FILE'; readonly readId: number; readonly file: DroppedFile }
  | { readonly type: 'NAVIGATE'; readonly href: string };
