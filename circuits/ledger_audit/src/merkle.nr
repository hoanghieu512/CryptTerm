// Merkle tree over N leaves. Leaf index i is position i at level 0.
// Parent j at level l + 1 is node_hash(level_l[2j], level_l[2j + 1]). DEPTH reductions
// (N, N/2, ..., 2, 1) give the root.

use crate::hash::node_hash;
use crate::N;

// One level up: IN nodes become OUT nodes. The static_assert runs once per use at compile time.
fn halve<let IN: u32, let OUT: u32>(level: [Field; IN]) -> [Field; OUT] {
    std::static_assert(IN == 2 * OUT, "HALVE INPUT LENGTH IS NOT TWICE OUTPUT LENGTH");
    let mut next = [0; OUT];
    for j in 0..OUT {
        next[j] = node_hash(level[2 * j], level[2 * j + 1]);
    }
    next
}

pub fn compute_root(leaves: [Field; N]) -> Field {
    let level_1: [Field; N / 2] = halve(leaves);
    let level_2: [Field; N / 4] = halve(level_1);
    let level_3: [Field; N / 8] = halve(level_2);
    let level_4: [Field; N / 16] = halve(level_3);
    let level_5: [Field; N / 32] = halve(level_4);
    let level_6: [Field; 1] = halve(level_5);
    level_6[0]
}
