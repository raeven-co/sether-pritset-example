// ============================================================================
// STEP 3 — SETHER: detokenize AFTER the AI step, before document generation.
//
// This module only talks to Sether. It uses the same vault that produced the
// tokens in step 1 and swaps every token back to its original value. The
// restored data exists only inside your process, on its way to Pritset —
// the AI provider never saw it.
// ============================================================================

import { restoreSync } from '@raeven-co/sether';
import { vault } from './sether-tokenize.ts';
import type { JsonValue } from './types.ts';

function restoreText(text: string): string {
  return restoreSync(text, { vault });
}

// Restore each string field individually (mirroring how step 1 tokenized
// them). Working on parsed values rather than serialized JSON means original
// values containing quotes or backslashes can never corrupt the document.
function walk(node: JsonValue): JsonValue {
  if (typeof node === 'string') return restoreText(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node !== null && typeof node === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = walk(value);
    }
    return out;
  }
  return node;
}

// Structure-preserving transform, same reasoning as tokenizePayload.
export function detokenize<T extends JsonValue>(value: T): T {
  return walk(value) as T;
}
