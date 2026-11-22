// Loaded with `node --import ./scripts/register-ts.mjs <script.ts>`. Dependency free.
//
// Plain Node does not add `.ts` to a relative import such as `../src/ledger/parse`, but the code
// in `src/` imports without extensions (it is built by Vite). This registers a synchronous,
// in-thread resolve hook (`module.registerHooks`, Node 24): for a relative specifier (`./` or
// `../`) with no file extension, when `<specifier>.ts` exists next to the importer, it resolves
// to that file. Anything else goes to the default resolver, so packages, `node:` modules and
// specifiers with extensions are untouched.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELATIVE_SPECIFIER = /^\.\.?\//;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parentURL = context.parentURL;
    if (
      typeof parentURL === 'string' &&
      parentURL.startsWith('file:') &&
      RELATIVE_SPECIFIER.test(specifier) &&
      extname(specifier) === ''
    ) {
      const candidate = new URL(`${specifier}.ts`, parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
