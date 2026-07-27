// ============================================================================
// STEP 2 — AI: the only step that would talk to a model provider.
//
// It receives ONLY the tokenized payload. By the time execution reaches this
// module, every sensitive value has already been replaced by a stable token
// (<EMAIL_...>, <PHONE_...>, <NAME_...>, ...), so nothing personal can cross
// the trust boundary regardless of what this step does with the data.
//
// This example ships with a deterministic simulation so it runs without API
// keys. To use a real provider, replace `simulateTemplateAssistant` with a
// call to your LLM of choice — the contract is simply:
//   tokenized JSON in -> AI-assisted output (which may echo tokens) out.
// ============================================================================

export async function runAiStep(tokenizedPayload) {
  return simulateTemplateAssistant(tokenizedPayload);
}

// Simulates "AI-assisted template creation": the assistant inspects a sample
// payload and drafts the DOCX placeholder plan plus a cover note. Note that
// it freely echoes field values — because they are tokens, that is safe.
function simulateTemplateAssistant(payload) {
  const placeholders = collectPlaceholders(payload);
  return {
    suggestedPlaceholders: placeholders,
    draftCoverNote:
      `Invoice ${payload.invoiceNumber} for ${payload.customer.name} ` +
      `(${payload.customer.email}, ${payload.customer.phone}). ` +
      `Total due: ${payload.total} by ${payload.dueDate}.`,
    templateAdvice:
      'Use a repeating table row bound to items[] with columns description, ' +
      'quantity, unitPrice. Place customer fields in the header block.',
  };
}

function collectPlaceholders(node, prefix = '') {
  if (Array.isArray(node)) {
    return node.length > 0
      ? collectPlaceholders(node[0], `${prefix}[]`)
      : [];
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      collectPlaceholders(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [`{${prefix}}`];
}
