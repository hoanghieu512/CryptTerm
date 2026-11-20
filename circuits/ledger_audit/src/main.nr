mod hash;
mod merkle;
mod posting;
mod test_support;
mod tests;

use crate::hash::leaf_hash;
use crate::merkle::compute_root;
use crate::posting::{FLAG_SET, is_padding, leaf_fields, Posting, SIDE_CREDIT, SIDE_DEBIT};

global N: u32 = 64; // Capacity. The only place the literal appears.
global DEPTH: u32 = 6; // log2(N)
global AMOUNT_BOUND: u64 = 1099511627776; // 2^40, exclusive upper bound

// Compile-time check that DEPTH matches N. A global is used because a statement
// cannot sit at module level, and a function that is never called is not checked.
pub global DEPTH_MATCHES_CAPACITY: bool = check_depth();

fn check_depth() -> bool {
    std::static_assert(1 << DEPTH == N, "DEPTH DOES NOT MATCH CAPACITY");
    true
}

// The ten constraints run in this order (design, "Constraint list"). Every `assert` message is a
// string literal, unique, and not a substring of another (`nargo test` matches case-insensitively).
// Range checks (3 to 6) come before any sum or comparison that relies on them, so no arithmetic
// runs on an unchecked value. `||` and `&&` do not exist in Noir 1.0.0; `|` and `&` on `bool`
// are used instead. Every `<`, `<=` and `>=` is between typed integers, never on a `Field`.
fn main(
    merkle_root: pub Field,
    record_count: pub u32,
    limit_cents: pub u64,
    postings: [Posting; N],
) {
    // (1) and (2): 1 <= record_count <= N.
    assert(record_count >= 1, "RECORD COUNT BELOW 1");
    assert(record_count <= N, "RECORD COUNT ABOVE CAPACITY");

    // (3): the policy limit is in range.
    assert(limit_cents < AMOUNT_BOUND, "LIMIT OUT OF RANGE");

    // (4) to (7), over all N slots, real and padding.
    for i in 0..N {
        let posting = postings[i];
        // (4) side is D (0) or C (1).
        assert(posting.side <= SIDE_CREDIT, "SIDE NOT D OR C");
        // (5) review flag is N (0) or Y (1).
        assert(posting.review_flag <= FLAG_SET, "FLAG NOT Y OR N");
        // (6) amount is below 2^40.
        assert(posting.amount < AMOUNT_BOUND, "AMOUNT OUT OF RANGE");
        // (7) a slot at index >= record_count has all six fields zero.
        assert((i < record_count) | is_padding(posting), "PADDING SLOT NOT NEUTRAL");
    }

    // (8) all N leaves, padding included, hash to the public root.
    let mut leaves = [0; N];
    for i in 0..N {
        leaves[i] = leaf_hash(leaf_fields(postings[i]));
    }
    assert(compute_root(leaves) == merkle_root, "MERKLE ROOT MISMATCH");

    // (9) debits equal credits. Each amount is below 2^40 after (6), so each u64 total is below
    // 2^46 and cannot overflow. Padding slots have side 0 and amount 0, so they add nothing.
    let mut debit_total: u64 = 0;
    let mut credit_total: u64 = 0;
    for i in 0..N {
        let posting = postings[i];
        if posting.side == SIDE_DEBIT {
            debit_total += posting.amount;
        } else {
            credit_total += posting.amount;
        }
    }
    assert(debit_total == credit_total, "DEBITS NOT EQUAL TO CREDITS");

    // (10) every real posting (index < record_count) is within the limit or carries flag Y.
    for i in 0..N {
        let posting = postings[i];
        assert(
            (i >= record_count) | (posting.amount <= limit_cents) | (posting.review_flag == FLAG_SET),
            "OVER LIMIT WITHOUT REVIEW FLAG",
        );
    }
}
