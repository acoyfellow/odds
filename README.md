# odds

> [!CAUTION]
> **Eval result: the main claim is disproven.** On 255 real issues, `odds` beat Claude Opus on quality (F1 0.81 against 0.45) and let no planted injection through, but it was 3 to 7 times slower and cost 13 to 27% of the baseline, not 10% or less. Read [EVAL.md](EVAL.md) before you use it.

> Ask for odds, not prose.

**Problem:** an agent that triages 250 issues, screens 40 fetched pages, or checks whether a
child agent's receipt proves its gate does it by reading every item into a frontier model. That
is slow and costly, it fills the context window, and the judgment changes from item to item.

**Promise:** `odds` is a Pi extension. It registers Cloudflare's Clef decision models as Pi
classifier models and sends every call through your own AI Gateway with a scoped token. A codemode script asks a typed question about every item. It gets back a probability
for each allowed answer and returns only the result to the frontier model.

Docs: <https://odds.coey.dev>. The site is static. It has no bindings and cannot call Clef.

## Quick start

1. Create a Cloudflare API token with **AI Gateway: Run** and **Workers AI: Read**, limited
   to the account that owns the gateway.
2. Install and configure:

```bash
pi install git:github.com/acoyfellow/odds
mkdir -p ~/.config/odds && chmod 700 ~/.config/odds
echo '{"accountId":"<gateway-account-id>","gateway":"default"}' > ~/.config/odds/config.json
chmod 600 ~/.config/odds/config.json
security add-generic-password -a "$USER" -s odds-gateway -w
```

3. Turn on codemode with `"defaultTools": ["+codemode"]` in Pi settings, then run `/reload`.

Then, in a codemode script:

```js
const clef = await models.getModelOfType('classifier', 'odds', 'clef');
const r = await models.classify(clef, {
  state: { ticket: 'Checkout is down for every customer.' },
  questions: {
    urgent: { type: 'bool', instructions: 'Needs an engineer today?', criteria: { true: 'Yes', false: 'No' } },
  },
});
r.answers.urgent.probability;
```

## Models

| Pi id | Workers AI | Price |
| --- | --- | --- |
| `odds/clef` | `@cf/cloudflare/clef` | $0.24 / M input, 27B, vision |
| `odds/clef-flash` | `@cf/cloudflare/clef-flash` | $0.09 / M input |

## Auth

| Part | Behavior |
| --- | --- |
| Token | A dedicated API token: AI Gateway Run plus Workers AI Read, one account. odds never uses your wrangler login. |
| Lookup order | `ODDS_TOKEN` (for CI), then the macOS Keychain service `odds-gateway`, then `~/.config/odds/token`. The token file is refused unless it is chmod 600. |
| Access | Calls to the gateway route with no token or a forged token are rejected (HTTP 401). `prove:auth` checks this. odds does not check the gateway's own authentication setting. |
| Exposure | The token is read at request time and sent only as a bearer header to `gateway.ai.cloudflare.com`. It is redacted from every error and receipt. |

## How it works

```text
codemode script
  -> models.classify(odds/clef, { state, questions })
    -> odds: validate input          (reject before any network call)
    -> resolve scoped token          (env | keychain | chmod-600 file)
    -> AI Gateway, bearer token      (your account: logs, caching, rate limits)
      -> Workers AI @cf/cloudflare/clef
    -> odds: validate answers        (known labels, argmax, sum = 1, score in range, [0,1])
  <- answers, or stopReason "error" with a redacted message
```

The load-bearing primitive is `runOdds` in `src/client.ts`. It is one function with two
checks, input validation and answer validation, and it accepts any transport. A malformed
model answer never becomes a confident result.

## Proof

```bash
bun run verify      # tsc + biome + tests: answer checks, token lookup order, redaction
bun run prove:auth  # anonymous and forged calls rejected; scoped keychain token accepted
bun run prove:pi    # real Pi session -> models.classify -> odds/clef
bun run prove:docs  # odds.coey.dev is static: 200, connect-src 'none', no API, no bindings
```

Receipts are in `receipts/`. The claim ledger is in `status.json`. Receipts 003 to 005
come from real dogfood: Clef calls made from inside an interactive Pi session on real work.
The `prove:*` scripts write fresh results to `proof-runs/`, which git ignores.

## Limits

- **Not a chat model.** Clef returns probabilities over the options you define.
- **Not an authority.** Odds are evidence. Your code or an independent verifier makes the
  decision.
- **No public endpoint.** This repo deploys no model-calling surface.
- **Jev is not wired.** Jev has no route through the `default` gateway. See `findings.md`.

## Where to edit behavior

- Models and prices: `src/models.ts`
- Answer checks: `src/client.ts`
- Token lookup order: `src/credentials.ts`

## What this makes possible next

Per-item judgment becomes a cheap, typed and checked call that an agent can run inside its
own loop: screen untrusted text before it reaches context, rank a queue, or check a child
agent's receipt. Each run writes a receipt with the same shape, so other notebooks can cite it.
