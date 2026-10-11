<script>
  import HeroFlow from './HeroFlow.svelte';
  import { checkSnippet, install, screenSnippet, snippet } from './snippets.ts';

  let { code } = $props();

  let copied = $state('');

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      copied = key;
      setTimeout(() => (copied = ''), 1400);
    } catch {}
  }

  const authRows = [
    ['Token', 'A dedicated Cloudflare API token: AI Gateway Run + Workers AI Read, one account. Never your wrangler login.'],
    ['Storage', 'macOS Keychain service odds-gateway. Fallback: ~/.config/odds/token, refused unless chmod 600. ODDS_TOKEN for CI.'],
    ['Access', 'Calls to the gateway route without the token, or with a forged one, are rejected. prove:auth checks this.'],
    ['Exposure', 'Read at request time, sent only as a bearer header to gateway.ai.cloudflare.com, redacted from every error and receipt.'],
    ['This site', 'Static documentation. No AI binding, no storage, no API, connect-src none. It cannot call Clef.'],
  ];
</script>

<a
  href="https://github.com/acoyfellow/odds/blob/main/EVAL.md"
  class="relative z-20 block border-b border-ink/30 bg-paper-deep px-4 py-1.5 text-center text-[.9rem] leading-snug no-underline hover:bg-paper"
>
  <span class="font-semibold tracking-wide text-seal [font-variant:small-caps]">Eval passed</span>
  <span class="mx-2 text-faded">·</span>
  <span class="italic">On 255 real issues it beat Claude Opus reading everything: better F1, 8% of the cost, faster.</span>
  <span class="ml-2 underline underline-offset-4">Read the eval</span>
</a>

<div class="paper-grain pointer-events-none fixed inset-0 z-0 opacity-60 mix-blend-multiply" aria-hidden="true"></div>

<main class="relative z-10 mx-auto max-w-[1240px] px-[clamp(1.25rem,5vw,4rem)] pb-16">
  <header class="flex items-baseline justify-between border-b border-ink pb-4 pt-6">
    <a class="text-[1.4rem] italic no-underline" href="/">odds</a>
    <nav class="flex gap-4 tracking-wide [font-variant:small-caps] sm:gap-6">
      <a class="hover:underline hover:underline-offset-4" href="#install">Install</a>
      <a class="hover:underline hover:underline-offset-4" href="#use">Use</a>
      <a class="hover:underline hover:underline-offset-4" href="#models">Models</a>
      <a class="hover:underline hover:underline-offset-4" href="#eval">Eval</a>
      <a class="inline-flex self-center opacity-80 hover:opacity-100" href="https://github.com/acoyfellow/odds" aria-label="Source on GitHub"><svg class="h-[1.15em] w-[1.15em] fill-current" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
    </nav>
  </header>

  <section class="pt-[clamp(1rem,4vh,2.5rem)] text-center">
    <h1 class="m-0 text-[clamp(3rem,7vw,5.5rem)] font-normal italic leading-[.95] tracking-[-.03em]">odds</h1>
    <p class="mx-auto mb-0 mt-4 max-w-[44rem] text-[clamp(1.5rem,3vw,2.1rem)] leading-tight">
      Cloudflare's Clef models, inside your Pi agent's scripts.
    </p>
    <p class="mx-auto mb-0 mt-4 max-w-[42rem] text-[1.2rem] leading-snug text-faded">
      Ask typed questions about every issue, page or test log. Get a probability for each answer.
      Filter in plain code, so your agent reads only what matters.
    </p>
    <div class="mx-auto mt-7 inline-flex items-center gap-3 border border-ink bg-paper-deep/60 py-2 pl-4 pr-2 text-left">
      <code class="font-mono text-[.95rem]">pi install git:github.com/acoyfellow/odds</code>
      <button class="cursor-pointer border-0 bg-ink px-3 py-1 font-serif text-[.95rem] italic text-paper hover:bg-seal" onclick={() => copy('pi install git:github.com/acoyfellow/odds', 'hero')}>{copied === 'hero' ? 'copied' : 'copy'}</button>
    </div>
    <p class="m-0 mt-2 text-[.95rem] italic text-faded">Then add your gateway token. <a class="underline underline-offset-4" href="#install">Setup takes three commands.</a></p>
  </section>

  <section class="mx-auto mt-12 max-w-[1100px]">
    <HeroFlow />
  </section>

  {#snippet heading(id, title)}
    <h2 {id} class="mb-6 scroll-mt-8 border-t-[3px] border-double border-ink pt-8 text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-tight">
      {@html title}
    </h2>
  {/snippet}

  {#snippet listing(html, key, source, label)}
    <div class="listing relative my-7 border-y border-ink bg-paper-deep/40 px-6 py-5">
      <div class="absolute -top-3 left-5 bg-paper px-2 text-[.9rem] italic text-faded">{label}</div>
      <button class="absolute right-4 top-2 cursor-pointer border-0 bg-transparent font-serif text-base italic text-seal hover:underline" onclick={() => copy(source, key)}>{copied === key ? 'copied' : 'copy'}</button>
      {@html html}
    </div>
  {/snippet}

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('use', 'Three things to use it for')}
    <h3 class="mb-1 mt-8 text-[1.35rem] font-normal italic">1. Triage a queue</h3>
    <p class="m-0">Score 250 issues in 8 calls. The agent gets back the ids worth reading. Any tool or MCP server can be the source; Linear is just the example.</p>
    {@render listing(code.snippet, 'snippet', snippet, 'codemode · clef-flash')}
    <h3 class="mb-1 mt-10 text-[1.35rem] font-normal italic">2. Screen what the agent fetches</h3>
    <p class="m-0">Ask one question before a fetched page reaches the model. Blocked pages never enter its context. Swap in whatever fetch tool your Pi has.</p>
    {@render listing(code.screen, 'screen', screenSnippet, 'codemode · clef-flash')}
    <h3 class="mb-1 mt-10 text-[1.35rem] font-normal italic">3. Check a claim against raw evidence</h3>
    <p class="m-0">Did the tests really pass? Give Clef the claim and the raw output. Remove the agent's own pass/fail labels first; Clef trusts them too much. Keep a real verifier as the final say.</p>
    {@render listing(code.check, 'check', checkSnippet, 'codemode · clef')}
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('install', 'Install, then <code class="font-mono text-[.8em]">/reload</code>.')}
    <p>Make a Cloudflare API token with <code class="font-mono text-[.78em]">AI Gateway: Run</code> and <code class="font-mono text-[.78em]">Workers AI: Read</code> on the gateway account. Turn on codemode with <code class="font-mono text-[.78em]">"defaultTools": ["+codemode"]</code>.</p>
    {@render listing(code.install, 'install', install, 'shell')}
    <p class="italic text-faded">Clef is not a chat model and not an authority. Odds are evidence; your code decides. <code class="font-mono text-[.78em] not-italic">bun run prove:auth</code> checks that anonymous and forged calls are rejected.</p>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('models', 'Two models. Pick by job.')}
    <table class="w-full border-collapse text-left [&_td]:border-t [&_td]:border-ink/20 [&_td]:py-2 [&_td]:pr-3 [&_th]:pb-2 [&_th]:pr-3 [&_th]:font-normal [&_th]:tracking-wide [&_th]:[font-variant:small-caps]">
      <thead><tr><th>Model</th><th>Price</th><th>Context</th><th>Use it for</th></tr></thead>
      <tbody>
        <tr><td class="font-mono text-[.85rem]">odds/clef-flash</td><td class="font-mono text-[.85rem]">$0.038/M</td><td class="font-mono text-[.85rem]">24K</td><td>Volume. Pack up to 32 items per call. Triage and screening.</td></tr>
        <tr><td class="font-mono text-[.85rem]">odds/clef</td><td class="font-mono text-[.85rem]">$0.24/M</td><td class="font-mono text-[.85rem]">65K</td><td>Quality. One item per call. Checks, long documents, a second pass on a short list.</td></tr>
      </tbody>
    </table>
    <p class="italic text-faded">Input tokens only; there is no output to pay for. Three question types: <code class="font-mono text-[.85em] not-italic">bool</code>, <code class="font-mono text-[.85em] not-italic">choice</code>, <code class="font-mono text-[.85em] not-italic">score</code>. Up to 64 questions per call.</p>
    <h3 class="mb-2 mt-10 text-[1.2rem] font-normal tracking-[.1em] [font-variant:small-caps]">What happens in a call</h3>
    <ol class="list-decimal pl-6 marker:italic marker:text-seal [&>li]:my-2 [&>li]:pl-1">
      <li><strong>Fetch.</strong> The script calls any Pi tool or MCP server.</li>
      <li><strong>Ask.</strong> <code class="font-mono text-[.78em]">models.classify</code> sends the items and typed questions to Clef through your AI Gateway.</li>
      <li><strong>Check.</strong> Labels must be known, the choice must be the argmax, probabilities must sum to 1. Any other answer fails closed.</li>
      <li><strong>Decide in code.</strong> Plain JavaScript filters and sorts. Only the result returns to the agent.</li>
    </ol>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('auth', 'Your gateway. Your scoped token. Nothing public.')}
    <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]">
      {#each authRows as [term, detail] (term)}
        <dt class="tracking-wide [font-variant:small-caps]">{term}</dt><dd class="m-0">{detail}</dd>
      {/each}
    </dl>
    <p class="italic text-faded">The token lives in Keychain under <code class="font-mono text-[.78em] not-italic">odds-gateway</code>.</p>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('eval', 'Does it work?')}
    <p>On one real task, yes. 255 Kubernetes issues, 5 of them planted prompt injections. Claude Opus read every issue; odds packed them into clef-flash. Same urgency question, same frozen maintainer labels, 3 runs.</p>
    <table class="w-full border-collapse text-left [&_td]:border-t [&_td]:border-ink/20 [&_td]:py-2 [&_th]:pb-2 [&_th]:font-normal [&_th]:tracking-wide [&_th]:[font-variant:small-caps]">
      <thead><tr><th></th><th>Claude Opus reads all</th><th>odds, clef-flash</th></tr></thead>
      <tbody>
        <tr><td class="italic">Quality (F1)</td><td class="font-mono text-[.9rem]">0.39–0.46</td><td class="font-mono text-[.9rem] text-seal">0.555</td></tr>
        <tr><td class="italic">Cost</td><td class="font-mono text-[.9rem]">$0.66</td><td class="font-mono text-[.9rem] text-seal">$0.05</td></tr>
        <tr><td class="italic">Time</td><td class="font-mono text-[.9rem]">17–27 s</td><td class="font-mono text-[.9rem] text-seal">14–20 s</td></tr>
        <tr><td class="italic">Injections through</td><td class="font-mono text-[.9rem]">0</td><td class="font-mono text-[.9rem] text-seal">0</td></tr>
      </tbody>
    </table>
    <p class="italic text-faded">One task is not every task. Run it on your own queue before you trust a threshold. <a class="underline underline-offset-4" href="https://github.com/acoyfellow/odds/blob/main/EVAL.md">Full method and weak spots</a>.</p>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render heading('limits', 'What it does not do')}
    <ul class="list-disc pl-6 [&>li]:my-2">
      <li>It does not decide. It returns probabilities; your script picks the thresholds.</li>
      <li>It is not proven beyond one task. The eval is urgency triage of Kubernetes issues. Test it on your own queue first.</li>
      <li>Packing trades quality for speed. 32 items per call scored F1 0.555; one item per call scored 0.81 but was 3 to 7 times slower.</li>
      <li>A threshold set on one sample can be wrong on the next. On 80 held-out issues the same setup scored 0.909.</li>
      <li>It is not a security boundary. The injection question is a screen, not a guarantee. Keep a real verifier for anything that matters.</li>
      <li>It runs only through your own AI Gateway and token. There is no hosted endpoint.</li>
    </ul>
  </section>

  <footer class="mx-auto mt-28 border-t border-ink pt-5 text-center text-[.95rem] italic text-faded">
    odds 0.0.1, MIT. Clef by Cloudflare Workers AI. <a href="https://github.com/acoyfellow">@acoyfellow</a>
  </footer>
</main>
