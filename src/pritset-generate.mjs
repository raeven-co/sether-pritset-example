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
// Configure via environment variables:
//   PRITSET_ACCESS_TOKEN, PRITSET_SECRET, PRITSET_TEMPLATE_ID
// ============================================================================

const PRITSET_DIRECT_URL = (templateId) =>
  `https://api.pritset.com/api/template/process/direct/${templateId}`;

export async function generatePdf(restoredPayload) {
  const accessToken = process.env.PRITSET_ACCESS_TOKEN;
  const secret = process.env.PRITSET_SECRET;
  const templateId = process.env.PRITSET_TEMPLATE_ID;

  if (!accessToken || !secret || !templateId) {
    console.log(
      '  Pritset credentials not set — skipping the live call.\n' +
        '  Set PRITSET_ACCESS_TOKEN, PRITSET_SECRET and PRITSET_TEMPLATE_ID\n' +
        '  to generate a real PDF. The request that would be sent:\n',
    );
    console.log(
      `  POST ${PRITSET_DIRECT_URL('{templateId}')}\n` +
        '  Authorization: {access token}\n' +
        '  X-Secret: {secret}\n' +
        `  form data=${JSON.stringify(restoredPayload)}\n`,
    );
    return null;
  }

  const form = new FormData();
  form.append('data', JSON.stringify(restoredPayload));

  const response = await fetch(PRITSET_DIRECT_URL(templateId), {
    method: 'POST',
    headers: { Authorization: accessToken, 'X-Secret': secret },
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `Pritset returned ${response.status}: ${await response.text()}`,
    );
  }

  const pdf = Buffer.from(await response.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile('output.pdf', pdf);
  console.log(`  PDF written to output.pdf (${pdf.length} bytes)`);
  return pdf;
}
