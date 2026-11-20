// Helpers for the tests in tests.nr. Noir 1.0.0 has no test-only module attribute, so this
// module compiles in the normal build and carries `#[allow(dead_code)]` on its functions.
// Nothing here is called from `main`, so none of it reaches the compiled circuit.
use crate::hash::leaf_hash;
use crate::merkle::compute_root;
use crate::N;
use crate::posting::{padding_posting, Posting, leaf_fields, SIDE_CREDIT, SIDE_DEBIT, FLAG_NOT_SET};

// Policy limit used by the tests, in cents.
pub global LIMIT: u64 = 1000000;

// Base batch: `real` real postings, then padding up to N slots.
// Slots 2k and 2k + 1 are a debit and a credit of the same amount 100000 + k, so the batch
// balances and every amount is below LIMIT. `real` must be even: the tests use 10 and 64
// (the design defines the helper for an even `real` only). With an odd `real` the last real
// slot would be a debit with no credit partner and the batch would not balance. No handling
// for that case is added.
#[allow(dead_code)]
pub fn base_postings(real: u32) -> [Posting; N] {
    let mut postings = [padding_posting(); N];
    for i in 0..N {
        if i < real {
            let k = i / 2;
            let side = if i % 2 == 0 { SIDE_DEBIT } else { SIDE_CREDIT };
            postings[i] = Posting {
                record_id: (100000 + i) as Field,
                account: 1000000000000000 + (i as Field),
                side,
                amount: 100000 + (k as u64),
                review_flag: FLAG_NOT_SET,
                salt: 7000000 + (i as Field),
            };
        }
    }
    postings
}

// Merkle root of the given postings, built from the same Noir functions as the circuit.
#[allow(dead_code)]
pub fn root_of(postings: [Posting; N]) -> Field {
    let mut leaves = [0; N];
    for i in 0..N {
        leaves[i] = leaf_hash(leaf_fields(postings[i]));
    }
    compute_root(leaves)
}

// A copy of `postings` with slot `i` replaced by `posting`.
#[allow(dead_code)]
pub fn with_slot(postings: [Posting; N], i: u32, posting: Posting) -> [Posting; N] {
    let mut out = postings;
    out[i] = posting;
    out
}
