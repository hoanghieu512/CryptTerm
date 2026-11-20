// Poseidon2 on BN254, built on the public `std::hash::poseidon2_permutation` (state width 4).
// Sponge convention: the same as `poseidon2Hash` in bb.js. Rate 3, capacity element
// `state[3]` starts at `input_length * 2^64`, output is `state[0]`.
// Decision D3: the sponge is written here because the standard library keeps its own
// sponge private and no external hash dependency is used.

use std::hash::poseidon2_permutation;

// 2^64, the initial capacity multiplier.
global TWO_POW_64: Field = 18446744073709551616;

// Hash of two field elements: one permutation of [left, right, 0, 2 * 2^64], element 0.
pub fn node_hash(left: Field, right: Field) -> Field {
    let state = poseidon2_permutation([left, right, 0, 2 * TWO_POW_64]);
    state[0]
}

// Hash of six field elements: two permutations (two blocks of three), element 0.
pub fn leaf_hash(f: [Field; 6]) -> Field {
    let s = poseidon2_permutation([f[0], f[1], f[2], 6 * TWO_POW_64]);
    let t = poseidon2_permutation([s[0] + f[3], s[1] + f[4], s[2] + f[5], s[3]]);
    t[0]
}
