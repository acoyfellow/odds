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

## Iteration 3: dogfood from a real Pi session

All three runs used `models.classify(odds/clef)` from this interactive Pi session's codemode
after `/reload`.

- **003 injection screen: works.** A planted HTML-comment injection asking for
  `~/.config/odds/token` scored 0.99 on injection and 0.98 on exfiltration. The X post, the
  Hugging Face model card, the Cloudflare docs and a notes file all scored under 0.02.
  Cost: $0.0009.
- **004 domain triage: useful, with a loose threshold.** The three planted controls were
  right: keep `odds` and `pantry`, retire `cinder` (404). At p>0.5 it marked 56 of 100 domains
  for retirement. It read Access-gated 302/401 responses as broken and scored starred or
  recently deployed projects as stale. A safe shortlist (p>0.95 and a real 404) is `call`,
  `cinder`, `ralphwiggums-api` and `userdo`. `userdo` is the most-starred repo (138 stars),
  and its root returns 404, so a human should look before removing it. Cost: $0.009 for
  100 calls.
- **005 receipt gate: fails as a standalone gate (verified-disproved).** Clef accepted both
  real receipts (0.99 and 0.97). It rejected the claimed-but-failed test run, the wrong
  commit and the empty evidence. It accepted a forgery labelled `pass: true` whose detail
  showed HTTP 200 for an anonymous call (0.93). Lesson: remove self-reported pass and verdict
  fields before asking, and never let odds be the only verifier.
- **Proof hygiene:** the `prove:*` scripts now write to the gitignored `proof-runs/` folder.
  Committed receipts no longer change when proofs rerun.
- **Wording:** the README, docs and SECURITY file now claim only what `prove:auth` checks.
  The token is required on the gateway route. The gateway's own authentication setting was
  never checked.
