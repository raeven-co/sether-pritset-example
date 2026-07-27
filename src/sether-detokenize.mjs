// ============================================================================
// STEP 3 — SETHER: detokenize AFTER the AI step, before document generation.
//
// This module only talks to Sether. It re-uses the same instance (and
// therefore the same vault) that produced the tokens in step 1, and swaps
// every token back to its original value. The restored data exists only
// inside your process, on its way to Pritset — the AI provider never saw it.
// ============================================================================

import { Readable } from 'node:stream';
import { sether } from './sether-tokenize.mjs';

async function streamToString(stream) {
  let out = '';
  for await (const chunk of stream) out += chunk.toString();
  return out;
}

async function restoreText(text) {
  return streamToString(Readable.from([text]).pipe(sether.restore()));
}

// Restore each string field individually (mirroring how step 1 tokenized
// them). Working on parsed values rather than serialized JSON means original
// values containing quotes or backslashes can never corrupt the document.
export async function detokenize(node) {
  if (typeof node === 'string') return restoreText(node);
  if (Array.isArray(node)) {
    return Promise.all(node.map((item) => detokenize(item)));
  }
  if (node !== null && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = await detokenize(value);
    }
    return out;
  }
  return node;
}
