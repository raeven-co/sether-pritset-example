// ============================================================================
// Orchestrator — runs the four stages and prints exactly what each one
// sees, so the trust boundaries are visible in the output:
//
//   [1 SETHER]  original payload  -> tokenized payload      (PII removed)
//   [2 AI]      tokenized payload -> AI output with tokens  (no PII available)
//   [3 SETHER]  AI output + payload tokens -> restored JSON (PII back, locally)
//   [4 PRITSET] restored JSON     -> generated PDF          (original values)
// ============================================================================

import { readFile } from 'node:fs/promises';
import { assertInvoicePayload } from './types.ts';
import { tokenizePayload } from './sether-tokenize.ts';
import { runAiStep } from './ai-step.ts';
import { detokenize } from './sether-detokenize.ts';
import { generatePdf } from './pritset-generate.ts';

const banner = (label: string): void => {
  console.log(`\n${'='.repeat(72)}\n${label}\n${'='.repeat(72)}`);
};

const raw = await readFile(new URL('../payload.sample.json', import.meta.url), 'utf8');
const original = assertInvoicePayload(JSON.parse(raw));

banner('ORIGINAL PAYLOAD (never sent to the AI provider)');
console.log(JSON.stringify(original, null, 2));

banner('[1 SETHER] Tokenized payload — this is all the AI step is given');
const tokenized = tokenizePayload(original);
console.log(JSON.stringify(tokenized, null, 2));

banner('[2 AI] AI-assisted template output — tokens flow through untouched');
const aiOutput = await runAiStep(tokenized);
console.log(JSON.stringify(aiOutput, null, 2));

banner('[3 SETHER] Restored payload + AI output — originals back, locally');
const restoredPayload = detokenize(tokenized);
const restoredCoverNote = detokenize(aiOutput.draftCoverNote);
console.log('payload:', JSON.stringify(restoredPayload, null, 2));
console.log('aiOutput.draftCoverNote:', restoredCoverNote);

const roundTripOk = JSON.stringify(restoredPayload) === JSON.stringify(original);
console.log(`\nround-trip identity check: ${roundTripOk ? 'PASS' : 'FAIL'}`);
if (!roundTripOk) process.exit(1);

banner('[4 PRITSET] Generate the PDF from the restored payload');
await generatePdf(restoredPayload);
