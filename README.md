# Sether + Pritset — PII-safe AI-assisted document workflow

A minimal, runnable example of PII-safe AI-assisted document generation with
a DOCX-template-to-PDF API ([Pritset](https://pritset.com)): tokenize
sensitive fields **before** the AI step, and use the original values **only**
at document generation time.

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
| 1 | `src/sether-tokenize.mjs` | Sether only |
| 2 | `src/ai-step.mjs` | AI provider only (simulated by default) |
| 3 | `src/sether-detokenize.mjs` | Sether only |
| 4 | `src/pritset-generate.mjs` | Pritset only |

Pritset itself never calls an AI model; Sether is purely an optional
preprocessing layer for customers whose workflows include an AI step before
document generation. The two products never touch the same request.

## Run it

Requires Node 18+.

```bash
npm install
npm start
```

Without Pritset credentials, stages 1-3 run fully (including a round-trip
identity check asserting the restored payload is byte-identical to the
original) and stage 4 prints the exact request it would send.

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
`node --env-file=.env src/run.mjs` (Node 20.6+).

The synthetic payload is `payload.sample.json` (invoice-shaped: customer
name, email, phone, address, IBAN, card number — all fake). Swap it for any
payload matching your template.

## Notes on the Sether side

- Pattern-shaped values (email, phone, card, IBAN) are detected on the raw
  value with the default `basicDetectors`.
- Name and address values have no distinctive shape, so Sether's identity
  pack detects them via **label anchoring** rather than free-text NER. In a
  structured payload the JSON key is the label, so `sether-tokenize.mjs`
  synthesizes the anchor from the key (`name` -> `Name: <value>`), redacts,
  and strips the anchor. Free-prose NER is a separate roadmap track. Note
  the capture is punctuation-bounded: a name like `Anne "Annie" O'Brien`
  tokenizes only the leading plain-text portion. Round-trip integrity is
  unaffected; it is a detection-coverage boundary, not a corruption risk.
- Tokens are stable, JSON-safe strings, so the AI step can echo, rearrange,
  or embed them in generated text; `restore()` swaps every occurrence back,
  including inside the AI output (see `draftCoverNote` in the run output).
- The vault (token-to-value map) lives in the `Sether` instance in your
  process. Nothing sensitive is persisted or transmitted by Sether.

## Plugging in a real model

`src/ai-step.mjs` ships with a deterministic simulation so the example runs
without API keys. To use a real provider, replace `simulateTemplateAssistant`
with a call to your LLM — the contract is: tokenized JSON in, AI output
(which may echo tokens) out. Everything else stays identical.

---

Sether: [@raeven-co/sether on npm](https://www.npmjs.com/package/@raeven-co/sether) ·
[sether on PyPI](https://pypi.org/project/sether/) ·
[live sandbox](https://setherai.vercel.app/#sandbox)
Pritset: [pritset.com/docs](https://pritset.com/docs/intro)
