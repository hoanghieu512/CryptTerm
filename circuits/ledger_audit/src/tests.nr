// The 13 required circuit tests. Each test calls `main(root_of(p), count, limit, p)` with a
// witness built so that only the targeted constraint can reject it. The public merkle_root is
// `root_of` of the supplied slots in every test except `wrong_root_fails`.
//
// Written before the constraints exist: against a constraint-free `main` the eight `_fails`
// tests fail and the five `_passes` tests pass.
use crate::main;
use crate::N;
use crate::hash::{leaf_hash, node_hash};
use crate::posting::{
    FLAG_NOT_SET, FLAG_SET, leaf_fields, padding_posting, Posting, SIDE_CREDIT, SIDE_DEBIT,
};
use crate::test_support::{base_postings, LIMIT, root_of, with_slot};

// Known-answer vectors from the design (Q1 table), computed with bb.js 6.0.0 `poseidon2Hash`.
// Hex is big-endian, copied from the design table. `leaf(...)` and `node(...)` are the
// bb.js convention that `hash.nr` implements.
// leaf([0, 0, 0, 0, 0, 0])
global PAD_LEAF: Field = 0x0286f724918d0f8663988824651273d4703d44b1cef1a9a31e4d1f6e0d35e8f8;
// leaf([1, 1000000000000001, 0, 250000, 1, 987654321])
global LEAF_A: Field = 0x259c4874e82dc29fd6b1cf8be4d604bceaebdd7c7c2a9a4052444cfc9d25a1ad;
// leaf([2, 1000000000000002, 1, 250000, 0, 123456789])
global LEAF_B: Field = 0x00a9e776d5c445c897eb24ef60bd057ef514d00fcb40bcf89a6d7cde29f5b1e8;
// node(LEAF_A, LEAF_B)
global NODE_A: Field = 0x2f83e3c909349719e9cb57a5d79a7a0989f971c02246fe6fc9d47e882b600af4;
// node(7, 8)
global NODE_SMALL: Field = 0x1f7a903ff6ebf6088f018bef42d630d28cc499eec89bec2ba6cc2763da3b957c;
// root of 64 PAD_LEAF leaves (levels 1 to 6 of node(x, x))
global EMPTY_ROOT: Field = 0x22d28221a316eb2b0ae742ae204890369a507e2d66bd93314f8f56c697af75c8;

// 2^40 written out on purpose, not taken from `AMOUNT_BOUND` in main.nr, so that a wrong
// bound in the circuit cannot also move the boundary the tests check.
global TWO_POW_40: u64 = 1099511627776;

// A copy of `p` with side, amount and review flag replaced. record_id, account and salt are kept.
#[allow(dead_code)]
fn restyle(p: Posting, side: u8, amount: u64, review_flag: u8) -> Posting {
    Posting {
        record_id: p.record_id,
        account: p.account,
        side,
        amount,
        review_flag,
        salt: p.salt,
    }
}

// Three real postings in slots 0 to 2 and padding everywhere else:
// slot 0 debit `top` flag Y, slot 1 credit `top - 1` flag Y, slot 2 credit 1 flag N.
// Debits `top` and credits `top - 1 + 1` are equal. Used for the 2^40 boundary tests.
#[allow(dead_code)]
fn three_real_postings(top: u64) -> [Posting; N] {
    let ids = base_postings(10);
    let mut p = base_postings(0);
    p[0] = restyle(ids[0], SIDE_DEBIT, top, FLAG_SET);
    p[1] = restyle(ids[1], SIDE_CREDIT, top - 1, FLAG_SET);
    p[2] = restyle(ids[2], SIDE_CREDIT, 1, FLAG_NOT_SET);
    p
}

// base_postings(10) with slots 0 and 1 replaced by a debit and a credit of `amount`.
#[allow(dead_code)]
fn base_with_pair(amount: u64, debit_flag: u8, credit_flag: u8) -> [Posting; N] {
    let b = base_postings(10);
    let p = with_slot(b, 0, restyle(b[0], SIDE_DEBIT, amount, debit_flag));
    with_slot(p, 1, restyle(b[1], SIDE_CREDIT, amount, credit_flag))
}

#[test]
fn valid_batch_passes() {
    let p = base_postings(10);
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "DEBITS NOT EQUAL TO CREDITS")]
fn unbalanced_by_one_cent_fails() {
    let b = base_postings(10);
    // Slot 0 goes from 100000 to 100001: still below LIMIT, still below 2^40.
    let p = with_slot(b, 0, restyle(b[0], SIDE_DEBIT, b[0].amount + 1, FLAG_NOT_SET));
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "OVER LIMIT WITHOUT REVIEW FLAG")]
fn over_limit_unflagged_fails() {
    // Slot 0 debit LIMIT + 1 with flag N, slot 1 credit LIMIT + 1 with flag Y. Balanced.
    let p = base_with_pair(LIMIT + 1, FLAG_NOT_SET, FLAG_SET);
    main(root_of(p), 10, LIMIT, p);
}

#[test]
fn over_limit_flagged_passes() {
    let p = base_with_pair(LIMIT + 1, FLAG_SET, FLAG_SET);
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "AMOUNT OUT OF RANGE")]
fn amount_at_2_pow_40_fails() {
    // Only slot 0 is at 2^40. Debits 2^40, credits (2^40 - 1) + 1.
    let p = three_real_postings(TWO_POW_40);
    main(root_of(p), 3, LIMIT, p);
}

#[test]
fn amount_2_pow_40_minus_1_passes() {
    // Slot 0 debit 2^40 - 1, slot 1 credit 2^40 - 2, slot 2 credit 1.
    let p = three_real_postings(TWO_POW_40 - 1);
    main(root_of(p), 3, LIMIT, p);
}

#[test]
fn amount_equal_limit_unflagged_passes() {
    let p = base_with_pair(LIMIT, FLAG_NOT_SET, FLAG_NOT_SET);
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "PADDING SLOT NOT NEUTRAL")]
fn nonzero_padding_fails() {
    let b = base_postings(10);
    // Slot 10 is a padding slot (count is 10). It becomes a debit of 5 with every other field
    // zero. Slot 1 becomes a credit of its amount + 5, so the batch still balances.
    let debit_5 = Posting {
        record_id: 0,
        account: 0,
        side: SIDE_DEBIT,
        amount: 5,
        review_flag: FLAG_NOT_SET,
        salt: 0,
    };
    let p = with_slot(
        with_slot(b, 10, debit_5),
        1,
        restyle(b[1], SIDE_CREDIT, b[1].amount + 5, FLAG_NOT_SET),
    );
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "MERKLE ROOT MISMATCH")]
fn wrong_root_fails() {
    let p = base_postings(10);
    main(root_of(p) + 1, 10, LIMIT, p);
}

#[test]
fn record_count_64_passes() {
    let p = base_postings(64);
    main(root_of(p), 64, LIMIT, p);
}

#[test(should_fail_with = "RECORD COUNT BELOW 1")]
fn record_count_0_fails() {
    // All 64 slots are padding, so the sums are 0 and 0 and every padding rule holds.
    let p = base_postings(0);
    main(root_of(p), 0, LIMIT, p);
}

#[test(should_fail_with = "RECORD COUNT ABOVE CAPACITY")]
fn record_count_65_fails() {
    let p = base_postings(64);
    main(root_of(p), 65, LIMIT, p);
}

#[test(should_fail_with = "LIMIT OUT OF RANGE")]
fn limit_at_2_pow_40_fails() {
    let p = base_postings(10);
    main(root_of(p), 10, TWO_POW_40, p);
}

// ---------------------------------------------------------------------------------------------
// Seven extension tests (design D7), added after the written-first run was saved.
// The three `_fails` tests below reuse the message of the constraint they target on purpose:
// the distinct-message rule of Requirement 5.2 applies to the 13 required tests only.
// ---------------------------------------------------------------------------------------------

#[test(should_fail_with = "SIDE NOT D OR C")]
fn side_value_2_fails() {
    // Slot 0 keeps its debit amount but has side 2. The root is the root of the supplied slots.
    // Constraint 4 fires at slot 0, inside the per-slot loop, before the root and the sums.
    let b = base_postings(10);
    let p = with_slot(b, 0, restyle(b[0], 2, b[0].amount, FLAG_NOT_SET));
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "FLAG NOT Y OR N")]
fn review_flag_value_2_fails() {
    // Slot 0 is an ordinary debit with review_flag 2. Constraint 5 fires at slot 0.
    let b = base_postings(10);
    let p = with_slot(b, 0, restyle(b[0], SIDE_DEBIT, b[0].amount, 2));
    main(root_of(p), 10, LIMIT, p);
}

#[test(should_fail_with = "PADDING SLOT NOT NEUTRAL")]
fn padding_nonzero_salt_fails() {
    // Slot 10 is a padding slot (count is 10) with salt 1 and every other field zero.
    // Amounts are unchanged, so the batch balances and constraint 8 holds for the supplied slots.
    let b = base_postings(10);
    let salted = Posting {
        record_id: 0,
        account: 0,
        side: SIDE_DEBIT,
        amount: 0,
        review_flag: FLAG_NOT_SET,
        salt: 1,
    };
    let p = with_slot(b, 10, salted);
    main(root_of(p), 10, LIMIT, p);
}

#[test]
fn leaf_hash_matches_bb_js() {
    assert_eq(leaf_hash([1, 1000000000000001, 0, 250000, 1, 987654321]), LEAF_A);
    assert_eq(leaf_hash([2, 1000000000000002, 1, 250000, 0, 123456789]), LEAF_B);
}

#[test]
fn node_hash_matches_bb_js() {
    assert_eq(node_hash(LEAF_A, LEAF_B), NODE_A);
    assert_eq(node_hash(7, 8), NODE_SMALL);
}

#[test]
fn padding_leaf_matches_bb_js() {
    // Through the posting encoding, and directly on six zeros: both must give PAD_LEAF.
    assert_eq(leaf_hash(leaf_fields(padding_posting())), PAD_LEAF);
    assert_eq(leaf_hash([0; 6]), PAD_LEAF);
}

#[test]
fn empty_root_matches_bb_js() {
    assert_eq(root_of([padding_posting(); N]), EMPTY_ROOT);
}
