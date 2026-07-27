// ============================================================================
// STEP 1 — SETHER: tokenize the payload BEFORE anything reaches an AI model.
//
// This module only talks to Sether. It never calls an AI provider and never
// calls Pritset. The token vault lives inside the Sether instance, which
// stays in your process — the token-to-value map never leaves your boundary.
// ============================================================================

import { Sether, basicDetectors, identityDetectors } from '@raeven-co/sether';
import { Readable } from 'node:stream';

// One shared instance: the same vault must be used later to detokenize.
export const sether = new Sether({
  detectors: [...basicDetectors, ...identityDetectors],
});

async function streamToString(stream) {
  let out = '';
  for await (const chunk of stream) out += chunk.toString();
  return out;
}

async function redactText(text) {
  return streamToString(Readable.from([text]).pipe(sether.redact()));
}

// Pattern detectors (email, phone, card, IBAN) fire on the raw value.
// Name/address values have no distinctive shape, so Sether's identity pack
// is label-anchored. In a structured payload the JSON key IS the label, so
// we synthesize the anchor from the key, redact, then strip the anchor.
const LABELLED_KEYS = {
  name: 'Name',
  address: 'Address',
};

async function redactLabelled(label, value) {
  const anchored = `${label}: ${value}`;
  const redacted = await redactText(anchored);
  return redacted.startsWith(`${label}: `)
    ? redacted.slice(label.length + 2)
    : redacted;
}

export async function tokenizePayload(node) {
  if (Array.isArray(node)) {
    return Promise.all(node.map((item) => tokenizePayload(item)));
  }
  if (node !== null && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && LABELLED_KEYS[key.toLowerCase()]) {
        out[key] = await redactLabelled(LABELLED_KEYS[key.toLowerCase()], value);
      } else if (typeof value === 'string') {
        out[key] = await redactText(value);
      } else {
        out[key] = await tokenizePayload(value);
      }
    }
    return out;
  }
  return node;
}
