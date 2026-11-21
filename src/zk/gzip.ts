// gzip and base64 helpers for the compiled circuit and the witness.
//
// `circuitProve` in bb.js takes the UNCOMPRESSED ACIR and witness, while the
// Artifact `bytecode` is base64 of gzip and `noir.execute` returns a gzipped
// witness. `DecompressionStream('gzip')` and `atob` exist in Node 24, in pages
// and in Web Workers, so the same code runs in all three. No `Buffer`.
//
// Errors carry a FIXED message. They never include input bytes.

const GZIP_INVALID = 'GZIP DATA INVALID';
const BASE64_INVALID = 'BASE64 DATA INVALID';

// Standard alphabet, optional trailing padding, no whitespace. `atob` alone is
// too forgiving (it ignores ASCII whitespace and accepts missing padding).
const BASE64_SHAPE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Decodes standard base64 into bytes.
 *
 * The empty string is valid and gives an empty array. Throws
 * `Error('BASE64 DATA INVALID')` for any other malformed input: characters
 * outside the standard alphabet, whitespace, a length that is not a multiple
 * of 4, or misplaced padding.
 */
export function base64ToBytes(s: string): Uint8Array {
  if (typeof s !== 'string' || s.length % 4 !== 0 || !BASE64_SHAPE.test(s)) {
    throw new Error(BASE64_INVALID);
  }
  let binary: string;
  try {
    binary = atob(s);
  } catch {
    throw new Error(BASE64_INVALID);
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Decompresses gzip bytes. Throws `Error('GZIP DATA INVALID')` when the input
 * is not a complete, valid gzip stream (this includes empty input).
 */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(GZIP_INVALID);
  }
  // `WritableStream<BufferSource>` accepts only ArrayBuffer-backed views in the
  // TS lib types; the copy narrows `Uint8Array<ArrayBufferLike>` without a cast
  // (same pattern as `sha256Hex` in `srs.ts`).
  const input = new Uint8Array(bytes);
  try {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    // Write and read run together: awaiting the write first can stall on
    // back-pressure once the output is larger than the stream's queue.
    const writing = writer.write(input).then(() => writer.close());
    const reading = (async (): Promise<Uint8Array> => {
      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
      }
      const out = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    })();
    const [, decompressed] = await Promise.all([writing, reading]);
    return decompressed;
  } catch {
    throw new Error(GZIP_INVALID);
  }
}
