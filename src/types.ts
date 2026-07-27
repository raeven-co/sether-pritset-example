// Shared types for the example. JsonValue models any JSON-shaped payload;
// InvoicePayload is the concrete shape of payload.sample.json.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

// Type aliases (not interfaces) so they structurally satisfy JsonValue's
// index signature and flow through the generic tokenize/detokenize helpers.
export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: string;
};

export type InvoicePayload = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  payment: {
    iban: string;
    cardOnFile: string;
  };
  items: InvoiceItem[];
  total: string;
};

// Boundary validation: the payload file is external input, so assert its
// shape instead of trusting a cast.
export function assertInvoicePayload(value: unknown): InvoicePayload {
  const candidate = value as InvoicePayload;
  const ok =
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.invoiceNumber === 'string' &&
    typeof candidate.customer === 'object' &&
    typeof candidate.customer.name === 'string' &&
    typeof candidate.customer.email === 'string' &&
    typeof candidate.payment === 'object' &&
    Array.isArray(candidate.items) &&
    typeof candidate.total === 'string';
  if (!ok) {
    throw new Error('payload.sample.json does not match the InvoicePayload shape');
  }
  return candidate;
}
