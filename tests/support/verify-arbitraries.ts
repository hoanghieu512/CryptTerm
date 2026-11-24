// Shared arbitraries for the CTM900 verify-run tests (verifier design, "Testing Strategy"):
// well-formed report shapes, malformed reports, limit texts and edit and settle interleavings.
// Synthetic data only.
import fc from 'fast-check';
import type { VerifyStepName } from '../../src/zk/verifier';
import { VERIFY_DETAILS } from '../../src/zk/verifier';

export const STEP_NAMES = Object.keys(VERIFY_DETAILS) as VerifyStepName[];

/** A sentinel for fields that the screen must never echo. */
export const DETAIL_SENTINEL = 'D3T41L-S3NT1N3L-5551212';

interface PlainStep {
  name: unknown;
  ok: unknown;
  detail: unknown;
}

/**
 * A well-formed report: the first `k` steps pass, step `k` fails (`k` 0 to 5), or all six pass
 * (`k` 6). Every `detail` is the given text, which a test fills with a sentinel.
 */
export function wellFormedReport(k: number, detail: string = DETAIL_SENTINEL): { verdict: string; steps: PlainStep[] } {
  const ran = k >= 6 ? 6 : k + 1;
  const steps = STEP_NAMES.slice(0, ran).map((name, i): PlainStep => ({ name, ok: i < k, detail }));
  return { verdict: k >= 6 ? 'VERIFIED' : 'REJECTED', steps };
}

/** The seven report shapes: a first failure at each of the six steps, and all six passing. */
export const reportShapeArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 6 });

function okSteps(count: number): PlainStep[] {
  return STEP_NAMES.slice(0, count).map((name) => ({ name, ok: true, detail: DETAIL_SENTINEL }));
}

function throwingGetter(): unknown {
  const report = { verdict: 'VERIFIED' };
  Object.defineProperty(report, 'steps', {
    enumerable: true,
    get() {
      throw new Error(DETAIL_SENTINEL);
    },
  });
  return report;
}

function throwingStepName(): unknown {
  const step = { ok: true, detail: DETAIL_SENTINEL };
  Object.defineProperty(step, 'name', {
    enumerable: true,
    get() {
      throw new Error(DETAIL_SENTINEL);
    },
  });
  return { verdict: 'REJECTED', steps: [step] };
}

const swapped = (): unknown => {
  const steps = okSteps(6);
  const first = steps[1];
  const second = steps[2];
  if (first === undefined || second === undefined) throw new Error('FIXTURE: STEPS');
  steps[1] = second;
  steps[2] = first;
  return { verdict: 'VERIFIED', steps };
};

/** Values that are not a well-formed report. Each must end in REJECTED: VERIFIER ERROR. */
export const malformedReportArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom<unknown>(
    null,
    undefined,
    0,
    42,
    true,
    'VERIFIED',
    'REJECTED',
    [],
    {},
    { verdict: 'VERIFIED' },
    { steps: okSteps(6) },
    { verdict: 'VERIFIED', steps: [] },
    { verdict: 'REJECTED', steps: [] },
    { verdict: 'VERIFIED', steps: okSteps(5) },
    { verdict: 'VERIFIED', steps: okSteps(1) },
    { verdict: 'verified', steps: okSteps(6) },
    { verdict: 'PASSED', steps: okSteps(6) },
    { verdict: 'VERIFIED', steps: 'FORMAT' },
    { verdict: 'VERIFIED', steps: { length: 6 } },
    { verdict: 'REJECTED', steps: okSteps(3) },
    { verdict: 'REJECTED', steps: okSteps(6) },
    { verdict: 'REJECTED', steps: [...okSteps(2), { name: 'DIGEST_MATCH', ok: false }, { name: 'POLICY', ok: false }] },
    { verdict: 'REJECTED', steps: [{ name: 'FORMAT', ok: false }, { name: 'SIGNATURE', ok: true }] },
    { verdict: 'REJECTED', steps: [{ name: 'SIGNATURE', ok: false }] },
    { verdict: 'REJECTED', steps: [{ name: 'FORMAT', ok: 'false' }] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), { name: 'PROOF', ok: 1 }] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), { name: 'PROOF', ok: false }] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), { name: 'PROOF', ok: true }, { name: 'PROOF', ok: true }] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), null] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), 'PROOF'] },
    { verdict: 'VERIFIED', steps: [...okSteps(5), { name: 'proof', ok: true }] },
  ),
  fc.constant(swapped()),
  fc.constant(throwingGetter()),
  fc.constant(throwingStepName()),
  fc.anything(),
);

/** Limit texts: digits of every length up to 16, the edges of 2^40 and 2^53, and odd characters. */
export const limitTextArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 2n ** 40n - 1n }).map((v) => v.toString(10)) },
  { weight: 2, arbitrary: fc.constantFrom('0', '1', '1000000', '500000', '1099511627775', '1099511627776', '00', '01') },
  {
    weight: 2,
    arbitrary: fc.integer({ min: -4, max: 4 }).map((d) => (2n ** 53n + BigInt(d)).toString(10)),
  },
  { weight: 1, arbitrary: fc.string({ maxLength: 13 }) },
  { weight: 1, arbitrary: fc.constantFrom('', '-1', '+5', '1.5', '1e3', ' 5', '5 ', '0x10', '१२३') },
);

/** One edit or settle in an interleaving. `settle` settles the active run, `foreign` another id. */
export type RunOp =
  | { readonly kind: 'enter' }
  | { readonly kind: 'paste'; readonly text: string }
  | { readonly kind: 'limit'; readonly text: string }
  | { readonly kind: 'settle'; readonly shape: number }
  | { readonly kind: 'foreign' };

export const runOpArb: fc.Arbitrary<RunOp> = fc.oneof(
  fc.constant<RunOp>({ kind: 'enter' }),
  fc.string({ minLength: 1, maxLength: 12 }).map((text): RunOp => ({ kind: 'paste', text })),
  fc.constantFrom('1000000', '500000', '1', '0', '999').map((text): RunOp => ({ kind: 'limit', text })),
  reportShapeArb.map((shape): RunOp => ({ kind: 'settle', shape })),
  fc.constant<RunOp>({ kind: 'foreign' }),
);

export const runOpsArb: fc.Arbitrary<RunOp[]> = fc.array(runOpArb, { minLength: 1, maxLength: 14 });
