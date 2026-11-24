// Parser for the Netlify `_headers` text format. Build-time and test-time only (never imported by src/).
//
// Format: a line that starts in column 0 is a path pattern. The indented lines under it are
// `Name: value` headers for that pattern. Blank lines and `#` comment lines are ignored.
// `headersFor(path, text)` returns the headers of the block whose pattern equals `path` exactly.
// It throws when the text has no such block, so a missing policy fails loudly.

export function headersFor(path: string, text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let found = false;
  let inBlock = false;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      inBlock = raw.trim() === path;
      if (inBlock) found = true;
      continue;
    }
    if (!inBlock) continue;
    const line = raw.trim();
    const colon = line.indexOf(':');
    if (colon <= 0) throw new Error(`HEADERS: MALFORMED LINE UNDER ${path}`);
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name === '' || value === '') throw new Error(`HEADERS: MALFORMED LINE UNDER ${path}`);
    // Netlify joins repeated names with a comma.
    result[name] = name in result ? `${result[name]}, ${value}` : value;
  }
  if (!found) throw new Error(`HEADERS: NO ${path} BLOCK`);
  return result;
}
