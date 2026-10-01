# Findings

## Iteration 1

- **Clef works through AI Gateway with no extra setup.** `POST
  gateway.ai.cloudflare.com/v1/<acct>/default/workers-ai/@cf/cloudflare/clef` with
  `{ model, state, questions }` returns `{ result: { answers, usage } }`. The response envelope
  differs from the Workers AI REST `ai/run` envelope that Pi's built-in
  `cloudflare-workers-ai-system-one` API expects. That is why odds has its own transport.
- **Jev has no gateway route (negative result).** `workers-ai/typesafe/jev`,
  `@cf/typesafe/jev` and `@hf/typesafe/jev` all failed on the `default` gateway. The REST
  path `typesafe/jev` asks for unified billing auth on the gateway. odds ships Clef only.
- **Clef separates tone from urgency.** In the demo queue, OD-110 ("p99 latency 80ms to
  900ms") is calm (`none`) but urgent at 0.95. OD-116, the prompt injection, scored 0.97 on
  the injection question. One schema with three questions gives three independent results.
- **Cost:** 16 items with 3 questions each used 5,937 input tokens and cost $0.0014.
- **Bool criteria:** Pi's `bool` type includes `criteria`. Clef accepts it, but odds removes
  it from the request, because `noul` takes only `instructions`.
- **Deploy:** the `coey.dev` zone has 100 of 100 Workers custom domains. The site runs on
  `odds.coy.workers.dev` until a slot is freed.

## Iteration 2

- **Public playground retired.** It worked (live Clef plus a 429 at the cap), but any public
  model surface weakens the private auth story. It is deleted, along with `odds-capcheck` and
  the budget KV. Receipt: `receipts/retired/002-site-live-and-capped.json`.
- **Scoped token.** The token has only AI Gateway Run and Workers AI Read, on one account,
  and it is stored in the macOS Keychain. The wrangler OAuth fallback is removed. The gateway
  rejects calls with no token or a forged token.
- **Docs only.** `odds.coey.dev` runs on a Worker with no bindings and `connect-src 'none'`.
  It deployed past the guardrail with no override.
- **Local DNS:** the WARP DNS proxy (127.0.2.2) kept a negative cache for `odds.coey.dev`
  after the first failed lookups. Public resolvers returned the record right away.
