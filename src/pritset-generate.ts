// ============================================================================
// STEP 4 — PRITSET: generate the PDF from the restored (detokenized) payload.
//
// This module only talks to Pritset. It receives the fully restored JSON —
// original values, no tokens — and posts it to Pritset's direct processing
// endpoint. Sether plays no role here; by design the two products never
// touch the same request.
//
// Endpoint (from https://pritset.com/docs/api/template):
//   POST https://api.pritset.com/api/template/process/direct/{templateId}
//   Headers: Authorization (access token), X-Secret (secret)
//   Body:    multipart/form-data with a `data` field holding the JSON
//
// Configure via environment variables (see .env.example):
//   PRITSET_ACCESS_TOKEN, PRITSET_SECRET, PRITSET_TEMPLATE_ID
// ============================================================================

import { writeFile } from 'node:fs/promises';
import type { InvoicePayload } from './types.ts';

const directUrl = (templateId: string): string =>
  `https://api.pritset.com/api/template/process/direct/${templateId}`;

export async function generatePdf(
  restoredPayload: InvoicePayload,
): Promise<Uint8Array | null> {
  const accessToken = process.env['PRITSET_ACCESS_TOKEN'];
  const secret = process.env['PRITSET_SECRET'];
  const templateId = process.env['PRITSET_TEMPLATE_ID'];

  if (!accessToken || !secret || !templateId) {
    console.log(
      '  Pritset credentials not set — skipping the live call.\n' +
        '  Set PRITSET_ACCESS_TOKEN, PRITSET_SECRET and PRITSET_TEMPLATE_ID\n' +
        '  to generate a real PDF. The request that would be sent:\n',
    );
    console.log(
      `  POST ${directUrl('{templateId}')}\n` +
        '  Authorization: {access token}\n' +
        '  X-Secret: {secret}\n' +
        `  form data=${JSON.stringify(restoredPayload)}\n`,
    );
    return null;
  }

  const form = new FormData();
  form.append('data', JSON.stringify(restoredPayload));

  const response = await fetch(directUrl(templateId), {
    method: 'POST',
    headers: { Authorization: accessToken, 'X-Secret': secret },
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `Pritset returned ${response.status}: ${await response.text()}`,
    );
  }

  const pdf = new Uint8Array(await response.arrayBuffer());
  await writeFile('output.pdf', pdf);
  console.log(`  PDF written to output.pdf (${pdf.byteLength} bytes)`);
  return pdf;
}
