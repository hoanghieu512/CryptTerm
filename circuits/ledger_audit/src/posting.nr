// One posting slot. Leaf order: record_id, account, side, amount, review_flag, salt.
pub struct Posting {
    pub record_id: Field,
    pub account: Field,
    pub side: u8,         // 0 = D (debit), 1 = C (credit)
    pub amount: u64,      // integer cents
    pub review_flag: u8,  // 0 = N (not set), 1 = Y (set)
    pub salt: Field,
}

pub global SIDE_DEBIT: u8 = 0;
pub global SIDE_CREDIT: u8 = 1;
pub global FLAG_NOT_SET: u8 = 0;
pub global FLAG_SET: u8 = 1;

// Padding slot: all six fields zero.
pub fn padding_posting() -> Posting {
    Posting { record_id: 0, account: 0, side: 0, amount: 0, review_flag: 0, salt: 0 }
}

pub fn is_padding(posting: Posting) -> bool {
    (posting.record_id == 0)
        & (posting.account == 0)
        & (posting.side == 0)
        & (posting.amount == 0)
        & (posting.review_flag == 0)
        & (posting.salt == 0)
}

pub fn leaf_fields(posting: Posting) -> [Field; 6] {
    [
        posting.record_id,
        posting.account,
        posting.side as Field,
        posting.amount as Field,
        posting.review_flag as Field,
        posting.salt,
    ]
}
