<script>
  import { onMount } from 'svelte';

  let { queue, models } = $props();

  const STEP_MS = 240;
  const BATCH = 4;
  let revealed = $state(queue.rows.length);
  let playing = $state(false);
  let copied = $state('');

  const flagged = [...queue.rows]
    .filter((row) => row.answers.injection.probability > 0.5 || row.answers.urgent.probability > 0.5 || row.answers.frustration.choice !== 'none')
    .sort((a, b) => priority(b) - priority(a));

  function priority(row) {
    const tone = row.answers.frustration.probabilities;
    return row.answers.injection.probability * 3 + row.answers.urgent.probability * 2 + tone.high + tone.mild * 0.5;
  }

  function percent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function replay() {
    if (playing) return;
    playing = true;
    revealed = 0;
    while (revealed < queue.rows.length) {
      await sleep(STEP_MS);
      revealed = Math.min(queue.rows.length, revealed + BATCH);
    }
    playing = false;
  }

  onMount(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) replay();
  });

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      copied = key;
      setTimeout(() => (copied = ''), 1400);
    } catch {}
  }

  const install = `pi install git:github.com/acoyfellow/odds

mkdir -p ~/.config/odds && chmod 700 ~/.config/odds
cat > ~/.config/odds/config.json <<'EOF'
{ "accountId": "<gateway-account-id>", "gateway": "default" }
EOF
chmod 600 ~/.config/odds/config.json

security add-generic-password -a "$USER" -s odds-gateway -w`;

  const snippet = `const clef = await models.getModelOfType('classifier', 'odds', 'clef');
const { issues } = await tools.mcp__linear__list_issues({ state: 'open', limit: 250 });

const judged = await Promise.all(issues.map(async (issue) => {
  const r = await models.classify(clef, {
    state: issue,
    questions: {
      frustration: { type: 'choice', instructions: 'Tone of the writer only.',
        criteria: { none: 'Calm', mild: 'Irritated', high: 'Angry' } },
      urgent: { type: 'bool', instructions: 'Needs an engineer today?',
        criteria: { true: 'Yes', false: 'No' } },
    },
  });
  return { issue, ...r.answers };
}));

return judged
  .filter((j) => j.urgent.probability > 0.8)
  .map((j) => \`\${j.issue.id} \${j.issue.title}\`);`;

  const authRows = [
    ['Token', 'A dedicated Cloudflare API token: AI Gateway Run + Workers AI Read, one account. Never your wrangler login.'],
    ['Storage', 'macOS Keychain service odds-gateway. Fallback: ~/.config/odds/token, refused unless chmod 600. ODDS_TOKEN for CI.'],
    ['Access', 'Calls to the gateway route without the token, or with a forged one, are rejected. prove:auth checks this.'],
    ['Exposure', 'Read at request time, sent only as a bearer header to gateway.ai.cloudflare.com, redacted from every error and receipt.'],
    ['This site', 'Static documentation. No AI binding, no storage, no API, connect-src none. It cannot call Clef.'],
  ];
</script>

<div class="page">
  <div class="bloom" aria-hidden="true"></div>
  <div class="grid-bg" aria-hidden="true"></div>

  <header class="nav">
    <a class="brand" href="/"><span class="dot"></span>odds</a>
    <nav>
      <a href="#how">How it works</a>
      <a href="#auth">Auth</a>
      <a href="#install">Install</a>
      <a href="https://github.com/acoyfellow/odds">GitHub</a>
    </nav>
  </header>

  <section class="hero">
    <div>
      <p class="eyebrow">Pi extension · codemode · Clef</p>
      <h1>Ask for <span class="accent">odds</span>,<br />not prose.</h1>
      <p class="lede">
        Your agent writes one codemode script. The script asks Clef a typed question about every
        item and gets a probability for each allowed answer. The frontier model reads only the
        result. Every call goes through your own AI Gateway with your own scoped token.
      </p>
      <div class="stats">
        <div><span class="mono big">{queue.rows.length}</span><span class="label">items</span></div>
        <div><span class="mono big">{(queue.elapsedMs / 1000).toFixed(1)}s</span><span class="label">wall time</span></div>
        <div><span class="mono big">${queue.costUsd.toFixed(4)}</span><span class="label">Clef cost</span></div>
        <div><span class="mono big">{queue.inputTokens.toLocaleString()}</span><span class="label">Clef tokens</span></div>
      </div>
      <div class="actions">
        <a class="btn primary" href="#install">Install in Pi</a>
        <button class="btn" onclick={replay} disabled={playing}>{playing ? 'Replaying…' : 'Replay the run'}</button>
      </div>
    </div>

    <figure class="console">
      <div class="bar">
        <span class="lights"><i></i><i></i><i></i></span>
        <span class="mono">models.classify(odds/clef) × {queue.rows.length}</span>
        <span class="mono count">{revealed}/{queue.rows.length}</span>
      </div>
      <div class="rows">
        {#each queue.rows.slice(0, revealed) as row (row.id)}
          <div class="row" class:alert={row.answers.injection.probability > 0.5}>
            <span class="mono id">{row.id}</span>
            <span class="title">{row.title}</span>
            <span class="chip mono tone-{row.answers.frustration.choice}">{row.answers.frustration.choice}</span>
            <span class="meter" title="urgent {percent(row.answers.urgent.probability)}"><span style="width:{percent(row.answers.urgent.probability)}"></span></span>
            {#if row.answers.injection.probability > 0.5}<span class="chip mono inject">injection {percent(row.answers.injection.probability)}</span>{/if}
          </div>
        {/each}
      </div>
      {#if revealed >= queue.rows.length}
        <div class="result">
          <p class="label">returned to the frontier model</p>
          <ol>{#each flagged.slice(0, 6) as row (row.id)}<li><span class="mono">{row.id}</span> {row.title}</li>{/each}</ol>
        </div>
      {/if}
      <figcaption class="mono">Recorded Clef run, {queue.recordedAt.slice(0, 10)}. Shown as a recording: this site makes no model calls.</figcaption>
    </figure>
  </section>

  <section id="how" class="block">
    <p class="eyebrow">How it works</p>
    <h2>The agent writes the program. Clef answers the questions.</h2>
    <div class="two">
      <ol class="flow">
        <li><span class="mono step">01</span><div><strong>Fetch</strong><p>The script calls any Pi tool or MCP server, for example 250 Linear issues.</p></div></li>
        <li><span class="mono step">02</span><div><strong>Fan out</strong><p><span class="mono">models.classify</span> sends one typed request per item. Pi runs four at a time.</p></div></li>
        <li><span class="mono step">03</span><div><strong>Check</strong><p>odds checks each answer: labels must be known, the choice must be the argmax, probabilities must sum to 1, and scores must be in range. Any other answer fails closed.</p></div></li>
        <li><span class="mono step">04</span><div><strong>Decide in code</strong><p>Plain JavaScript filters and sorts the results. Only the result returns to the frontier model.</p></div></li>
      </ol>
      <div class="code">
        <div class="bar"><span class="mono">codemode</span><button class="ghost mono" onclick={() => copy(snippet, 'snippet')}>{copied === 'snippet' ? 'copied' : 'copy'}</button></div>
        <pre class="mono">{snippet}</pre>
      </div>
    </div>
    <div class="models">
      {#each models as model (model.id)}
        <div class="model"><span class="mono name">odds/{model.id}</span><span class="mono muted">{model.workersAiId}</span><span class="mono price">${model.inputUsdPerMillion}/M input</span></div>
      {/each}
    </div>
  </section>

  <section id="auth" class="block">
    <p class="eyebrow">Auth</p>
    <h2>Your gateway. Your scoped token. Nothing public.</h2>
    <dl class="auth">
      {#each authRows as [term, detail] (term)}
        <div><dt class="mono">{term}</dt><dd>{detail}</dd></div>
      {/each}
    </dl>
  </section>

  <section id="install" class="block">
    <p class="eyebrow">Install</p>
    <h2>Two minutes, then <span class="mono">/reload</span>.</h2>
    <p class="muted narrow">
      Create a Cloudflare API token with <span class="mono">AI Gateway: Run</span> and
      <span class="mono">Workers AI: Read</span> on the account that owns the gateway. Turn on codemode in Pi with
      <span class="mono">"defaultTools": ["+codemode"]</span>.
    </p>
    <div class="code">
      <div class="bar"><span class="mono">shell</span><button class="ghost mono" onclick={() => copy(install, 'install')}>{copied === 'install' ? 'copied' : 'copy'}</button></div>
      <pre class="mono">{install}</pre>
    </div>
    <ul class="limits">
      <li><strong>Not a chat model.</strong> Clef returns probabilities over the options you define. It never writes text.</li>
      <li><strong>Not an authority.</strong> Odds are evidence. Your code or a verifier makes the decision.</li>
      <li><strong>Proof, not promises.</strong> <span class="mono">bun run prove:auth</span> checks that the gateway rejects anonymous and forged calls.</li>
    </ul>
  </section>

  <footer class="foot mono">
    <span>odds 0.0.1 · MIT</span>
    <span>Clef by Cloudflare Workers AI · <a href="https://github.com/acoyfellow">@acoyfellow</a></span>
  </footer>
</div>

<style>
  :global(:root) {
    color-scheme: dark;
    --ink: #0b1118; --layer: #111a24; --layer-2: #182431; --layer-3: #223141;
    --text: #f7f9fb; --muted: #9baaba; --orange: #f6821f; --amber: #f7b53b;
    --blue: #71b8d8; --green: #63d5a2; --red: #ff7d68;
    --border: rgba(174, 196, 216, .14); --border-strong: rgba(174, 196, 216, .27);
    --sans: Inter, ui-sans-serif, system-ui, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  }
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: var(--ink); color: var(--text); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
  :global(::selection) { background: var(--orange); color: #170900; }

  .page { position: relative; min-height: 100vh; overflow: hidden; padding: 0 clamp(1rem, 4vw, 3rem) 3rem; }
  .bloom { position: absolute; inset: -20vh -10vw auto; height: 80vh; background: radial-gradient(60% 60% at 70% 20%, rgba(247,181,59,.15), transparent 70%), radial-gradient(40% 50% at 20% 0%, rgba(246,130,31,.1), transparent 70%); pointer-events: none; }
  .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%); pointer-events: none; }
  .page > :not(.bloom):not(.grid-bg) { position: relative; z-index: 1; max-width: 1180px; margin-left: auto; margin-right: auto; }

  .mono { font-family: var(--mono); }
  .muted { color: var(--muted); }
  .accent { background: linear-gradient(90deg, var(--orange), var(--amber)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .eyebrow { position: relative; display: inline-flex; margin: 0 0 1rem; padding: .42rem .7rem; color: var(--orange); font: 600 .62rem/1 var(--mono); letter-spacing: .18em; text-transform: uppercase; }
  .eyebrow::before, .eyebrow::after { content: ''; position: absolute; width: .5rem; height: .5rem; }
  .eyebrow::before { left: 0; top: 0; border-left: 1.5px solid currentColor; border-top: 1.5px solid currentColor; }
  .eyebrow::after { right: 0; bottom: 0; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; }
  .label { font: 500 .66rem var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 0; }

  .nav { display: flex; justify-content: space-between; align-items: center; padding: 1.4rem 0; }
  .brand { display: flex; gap: .55rem; align-items: center; font: 700 1.15rem var(--mono); text-decoration: none; color: var(--text); }
  .dot { width: .7rem; height: .7rem; border-radius: 50%; background: conic-gradient(var(--orange) 0 72%, var(--layer-3) 72% 100%); box-shadow: 0 0 18px rgba(246,130,31,.6); }
  .nav nav { display: flex; gap: 1.4rem; font-size: .86rem; }
  .nav nav a { color: var(--muted); text-decoration: none; }
  .nav nav a:hover { color: var(--text); }

  .hero { display: grid; grid-template-columns: 1fr 1.1fr; gap: clamp(2rem, 4vw, 4rem); padding: clamp(2rem, 7vh, 5rem) 0 5rem; align-items: start; }
  h1 { margin: 0; font-size: clamp(2.8rem, 6.4vw, 5.2rem); line-height: .98; letter-spacing: -.045em; font-weight: 800; }
  h2 { margin: 0 0 1.6rem; max-width: 26ch; font-size: clamp(1.6rem, 3vw, 2.3rem); line-height: 1.1; letter-spacing: -.036em; }
  .lede { max-width: 34rem; margin: 1.4rem 0 0; color: #c4d0d9; font-size: 1.06rem; line-height: 1.65; }
  .stats { display: grid; grid-template-columns: repeat(4, auto); gap: 1.6rem; margin-top: 2rem; }
  .stats div { display: flex; flex-direction: column; gap: .2rem; }
  .big { font-size: 1.3rem; font-weight: 600; }
  .actions { display: flex; gap: .7rem; margin-top: 2rem; }
  .btn { appearance: none; border: 1px solid var(--border-strong); background: var(--layer); color: var(--text); padding: .7rem 1.15rem; border-radius: .45rem; font: 600 .88rem var(--sans); cursor: pointer; text-decoration: none; }
  .btn:hover:not(:disabled) { border-color: var(--orange); }
  .btn:disabled { opacity: .55; }
  .btn.primary { background: linear-gradient(180deg, #ff9634, var(--orange)); border-color: transparent; color: #1a0c00; }
  .ghost { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: .76rem; }
  .ghost:hover { color: var(--text); }

  .console, .code { margin: 0; background: #080d13; border: 1px solid var(--border); border-radius: .7rem; box-shadow: 0 28px 100px rgba(0,0,0,.35); overflow: hidden; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .7rem .95rem; border-bottom: 1px solid var(--border); font-size: .72rem; color: var(--muted); background: rgba(17,26,36,.7); }
  .lights { display: flex; gap: .35rem; }
  .lights i { width: .55rem; height: .55rem; border-radius: 50%; background: var(--layer-3); }
  .lights i:first-child { background: var(--orange); }
  .count { color: var(--amber); }
  .rows { padding: .5rem; display: flex; flex-direction: column; gap: 2px; min-height: 22rem; }
  .row { display: grid; grid-template-columns: 4.4rem 1fr auto 5.5rem; gap: .8rem; align-items: center; padding: .46rem .6rem; border-radius: .3rem; font-size: .84rem; animation: rise .35s ease both; }
  .row.alert { background: rgba(255,125,104,.08); grid-template-columns: 4.4rem 1fr auto 5.5rem auto; }
  .id { color: var(--muted); font-size: .74rem; }
  .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip { font-size: .66rem; padding: .16rem .5rem; border-radius: 99px; border: 1px solid var(--border-strong); color: var(--muted); }
  .tone-high { color: var(--red); border-color: rgba(255,125,104,.45); background: rgba(255,125,104,.08); }
  .tone-mild { color: var(--amber); border-color: rgba(247,181,59,.4); }
  .tone-none { color: var(--green); border-color: rgba(99,213,162,.3); }
  .inject { color: #170900; background: var(--red); border-color: transparent; font-weight: 600; }
  .meter { height: .32rem; background: var(--layer-2); border-radius: 99px; overflow: hidden; }
  .meter span { display: block; height: 100%; background: linear-gradient(90deg, var(--amber), var(--orange)); }
  .result { border-top: 1px solid var(--border); padding: .95rem 1.1rem; background: linear-gradient(180deg, rgba(246,130,31,.06), transparent); }
  .result ol { margin: .6rem 0 0; padding-left: 1.2rem; font-size: .86rem; display: grid; gap: .2rem; }
  .result li span { color: var(--amber); margin-right: .35rem; font-size: .76rem; }
  figcaption { padding: .7rem 1.1rem; font-size: .68rem; color: var(--muted); border-top: 1px solid var(--border); }

  .block { margin-bottom: 6rem; }
  .two { display: grid; grid-template-columns: .9fr 1.1fr; gap: 2rem; align-items: start; }
  .flow { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.2rem; }
  .flow li { display: grid; grid-template-columns: 2.6rem 1fr; gap: .8rem; }
  .flow p { margin: .2rem 0 0; font-size: .9rem; line-height: 1.6; color: var(--muted); }
  .step { color: var(--orange); font-size: .8rem; padding-top: .15rem; }
  pre { margin: 0; padding: 1.1rem 1.2rem; font-size: .76rem; line-height: 1.65; overflow-x: auto; color: #d6e2ea; }
  .models { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
  .model { display: grid; gap: .25rem; padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: .5rem; background: rgba(17,26,36,.6); font-size: .78rem; }
  .model .name { font-size: .95rem; color: var(--text); }
  .model .price { color: var(--amber); }

  .auth { margin: 0; display: grid; gap: 1px; border: 1px solid var(--border); border-radius: .7rem; overflow: hidden; background: var(--border); }
  .auth div { display: grid; grid-template-columns: 9rem 1fr; gap: 1.5rem; padding: 1rem 1.2rem; background: rgba(17,26,36,.92); }
  .auth dt { color: var(--orange); font-size: .76rem; text-transform: uppercase; letter-spacing: .1em; padding-top: .1rem; }
  .auth dd { margin: 0; font-size: .92rem; line-height: 1.6; color: #c4d0d9; }

  .narrow { max-width: 44rem; line-height: 1.7; margin: -.6rem 0 1.4rem; }
  .limits { margin: 1.5rem 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .limits li { padding: 1rem; border: 1px solid var(--border); border-radius: .5rem; font-size: .86rem; color: var(--muted); line-height: 1.55; }
  .limits strong { color: var(--text); display: block; margin-bottom: .25rem; }

  .foot { display: flex; justify-content: space-between; padding-top: 2rem; border-top: 1px solid var(--border); font-size: .72rem; color: var(--muted); }
  .foot a { color: var(--blue); }

  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 900px) {
    .hero, .two, .models, .limits { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .auth div { grid-template-columns: 1fr; gap: .3rem; }
    .nav nav a:not(:last-child) { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
