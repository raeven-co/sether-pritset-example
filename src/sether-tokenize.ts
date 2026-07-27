// ============================================================================
// STEP 1 — SETHER: tokenize the payload BEFORE anything reaches an AI model.
//
// This module only talks to Sether. It never calls an AI provider and never
// calls Pritset. The vault (token-to-value map) is created here and stays in
// this process — it is the one thing that must never cross the trust
// boundary.
//
// Structured payloads are field-level work, so this uses Sether's sync API
// (redactSync) with an explicit shared MemoryVault. For streaming text
// (LLM responses, SSE), use sether.redact()/restore() streams instead.
// ============================================================================

import {
  basicDetectors,
  identityDetectors,
  MemoryVault,
  redactSync,
  type Detector,
} from '@raeven-co/sether';
import type { JsonValue } from './types.ts';

// One shared vault: step 3 must use the same one to detokenize.
export const vault = new MemoryVault();

const detectors: readonly Detector[] = [...basicDetectors, ...identityDetectors];

function redactText(text: string): string {
  return redactSync(text, { detectors, vault });
}

// Pattern detectors (email, phone, card, IBAN) fire on the raw value.
// Name/address values have no distinctive shape, so Sether's identity pack
// is label-anchored. In a structured payload the JSON key IS the label, so
// we synthesize the anchor from the key, redact, then strip the anchor.
const LABELLED_KEYS: Readonly<Record<string, string>> = {
  name: 'Name',
  address: 'Address',
};

function redactLabelled(label: string, value: string): string {
  const anchored = `${label}: ${value}`;
  const redacted = redactText(anchored);
  return redacted.startsWith(`${label}: `)
    ? redacted.slice(label.length + 2)
    : redacted;
}

function walk(node: JsonValue): JsonValue {
  if (typeof node === 'string') return redactText(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node !== null && typeof node === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, value] of Object.entries(node)) {
      const label = LABELLED_KEYS[key.toLowerCase()];
      out[key] =
        typeof value === 'string' && label !== undefined
          ? redactLabelled(label, value)
          : walk(value);
    }
    return out;
  }
  return node;
}

// Structure-preserving transform: every string is replaced in place, nothing
// else changes shape, so the input type is retained.
export function tokenizePayload<T extends JsonValue>(payload: T): T {
  return walk(payload) as T;
}
