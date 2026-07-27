# Sether + Pritset — PII-safe AI-assisted document workflow

A minimal, runnable TypeScript example of PII-safe AI-assisted document
generation with a DOCX-template-to-PDF API ([Pritset](https://pritset.com)):
tokenize sensitive fields **before** the AI step, and use the original values
**only** at document generation time.

```text
original JSON payload
        |
        v
[1 SETHER]   tokenize        -> PII replaced by stable tokens; vault stays local
        |
        v
[2 AI]       template assist -> the model only ever sees tokens
        |
        v
[3 SETHER]   detokenize      -> originals restored inside your process
        |
        v
[4 PRITSET]  generate PDF    -> restored JSON posted to the Pritset API
```

The four stages are deliberately kept in four separate modules so it is
unambiguous where each product's responsibility begins and ends:

| Stage | Module | Talks to |
| ----- | ------ | -------- |
| 1 | `src/sether-tokenize.ts` | Sether only |
| 2 | `src/ai-step.ts` | AI provider only (simulated by default) |
| 3 | `src/sether-detokenize.ts` | Sether only |
| 4 | `src/pritset-generate.ts` | Pritset only |

Pritset itself never calls an AI model; Sether is purely an optional
preprocessing layer for customers whose workflows include an AI step before
document generation. The two products never touch the same request.

## Quick start

Requires Node 18+.

```bash
npm install
npm start          # runs the full workflow (tsx src/run.ts)
npm run typecheck  # strict TypeScript check, no emit
```

Without Pritset credentials, stages 1-3 run fully (including a round-trip
identity check asserting the restored payload is identical to the original)
and stage 4 prints the exact request it would send.

### What success looks like

The run prints each stage under a banner. Verify these four things:

1. Under `[1 SETHER]`, the six sensitive fields (`name`, `email`, `phone`,
   `address`, `iban`, `cardOnFile`) appear as tokens like
   `<EMAIL_...>` — no original values remain.
2. Under `[2 AI]`, the `draftCoverNote` echoes tokens, not real values —
   proof the AI stage had nothing sensitive to leak.
3. Under `[3 SETHER]`, the originals are back and the line
   `round-trip identity check: PASS` is printed (the process exits non-zero
   on FAIL).
4. Under `[4 PRITSET]`, either a PDF is written or the exact pending request
   is printed, and the payload it carries contains original values, never
   tokens.

### Generating a real PDF

Upload a matching DOCX template in the Pritset portal and set:

```bash
export PRITSET_ACCESS_TOKEN=...   # Profile page -> access token
export PRITSET_SECRET=...         # Profile page -> secret
export PRITSET_TEMPLATE_ID=...    # Templates page
npm start
```

Or copy `.env.example` to `.env` and run
`npx tsx --env-file=.env src/run.ts`.

The synthetic payload is `payload.sample.json` (invoice-shaped: customer
name, email, phone, address, IBAN, card number — all fake). Swap it for any
payload matching your template; its expected shape is typed and validated at
the boundary in `src/types.ts`.

## Adopting this pattern in your own service

The example is a pipeline of four pure-ish functions, so lifting it into a
real service is mostly a matter of deciding where the vault lives:

```ts
import { basicDetectors, identityDetectors, MemoryVault, redactSync, restoreSync } from '@raeven-co/sether';

// One vault per request/job. Do not share a vault across tenants.
const vault = new MemoryVault();
const detectors = [...basicDetectors, ...identityDetectors];

const safeForAi = redactSync(JSON.stringify(payload), { detectors, vault });
const aiResult  = await callYourModel(safeForAi);          // tokens only
const restored  = restoreSync(aiResult, { vault });        // originals, locally
```

Rules that keep the boundary sound in production:

- **Scope the vault to the request or job**, then let it go out of scope.
  `MemoryVault` supports `maxEntries` and `ttlMs` if you need a longer-lived
  one, but the safest lifetime is "one document generation".
- **The vault never leaves your process.** Don't serialize it, don't log it,
  don't put it in a queue message. If the AI step happens in another service,
  the tokenized payload crosses the wire, not the vault.
- **Log the tokenized form, not the restored form.** The tokenized payload is
  safe to put in traces and error reports; the restored payload is exactly as
  sensitive as the original.
- **Detokenize as late as possible** — here, immediately before the Pritset
  call, which is the first component that legitimately needs real values.
- **Streaming?** This example uses the sync API because structured fields are
  small. For LLM streaming responses (SSE), use `sether.redact()` /
  `sether.restore()` transform streams or `createSSERedactStream` — same
  vault semantics, chunk-boundary safe.

## Notes on detection coverage

- Pattern-shaped values (email, phone, card, IBAN) are detected on the raw
  value with the default `basicDetectors`.
- Name and address values have no distinctive shape, so Sether's identity
  pack detects them via **label anchoring** rather than free-text NER. In a
  structured payload the JSON key is the label, so `sether-tokenize.ts`
  synthesizes the anchor from the key (`name` -> `Name: <value>`), redacts,
  and strips the anchor. Free-prose NER is a separate roadmap track. The
  capture is punctuation-bounded: a name like `Anne "Annie" O'Brien`
  tokenizes only the leading plain-text portion. Round-trip integrity is
  unaffected; it is a detection-coverage boundary, not a corruption risk.
- Tokens are stable, JSON-safe strings, so the AI step can echo, rearrange,
  or embed them in generated text; restoration swaps every occurrence back,
  including inside the AI output (see `draftCoverNote` in the run output).

## Plugging in a real model

`src/ai-step.ts` ships with a deterministic simulation so the example runs
without API keys. To use a real provider, replace `simulateTemplateAssistant`
with a call to your LLM — the contract is: tokenized payload in, AI output
(which may echo tokens) out. Everything else stays identical.

---

Sether: [@raeven-co/sether on npm](https://www.npmjs.com/package/@raeven-co/sether) ·
[sether on PyPI](https://pypi.org/project/sether/) ·
[live sandbox](https://setherai.vercel.app/#sandbox)
Pritset: [pritset.com/docs](https://pritset.com/docs/intro)
