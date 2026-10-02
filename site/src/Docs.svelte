<script>
  import ScoreFilm from './ScoreFilm.svelte';
  import { install, snippet } from './snippets.ts';

  let { queue, models, code } = $props();

  let copied = $state('');

  let focus = $state(null);

  const STAFF_TOP = 120;

  const LINE_GAP = 22;

  const STAFF_BOTTOM = STAFF_TOP + LINE_GAP * 4;

  const LEFT = 150;

  const RIGHT = 1440;

  const step = (RIGHT - LEFT) / queue.rows.length;

  const notes = queue.rows.map((row, index) => {
    const urgent = row.answers.urgent.probability;
    const injection = row.answers.injection.probability;

    return {
      row,
      x: LEFT + step * (index + 0.5),
      y: STAFF_BOTTOM + LINE_GAP - urgent * (LINE_GAP * 6),
      tone: row.answers.frustration.choice,
      urgent,
      injection,
      rest: injection > 0.5,
    };
  });

  const returned = [...notes]
    .sort((a, b) => b.injection * 3 + b.urgent * 2 - (a.injection * 3 + a.urgent * 2))
    .filter((note) => note.rest || note.urgent > 0.5)
    .slice(0, 6);

  function percent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function ledgerLines(y) {
    const lines = [];

    for (let line = STAFF_TOP - LINE_GAP; line >= y - 2; line -= LINE_GAP) lines.push(line);

    for (let line = STAFF_BOTTOM + LINE_GAP; line <= y + 2; line += LINE_GAP) lines.push(line);

    return lines;
  }

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

<div class="paper-grain pointer-events-none fixed inset-0 z-0 opacity-60 mix-blend-multiply" aria-hidden="true"></div>

<main class="relative z-10 mx-auto max-w-[1240px] px-[clamp(1.25rem,5vw,4rem)] pb-16">
  <header class="flex items-baseline justify-between border-b border-ink pb-4 pt-6">
    <a class="text-[1.4rem] italic no-underline" href="/">odds</a>
    <nav class="flex gap-4 tracking-wide [font-variant:small-caps] sm:gap-6">
      <a class="hover:underline hover:underline-offset-4" href="#movement-1">I. How</a>
      <a class="hover:underline hover:underline-offset-4" href="#movement-2">II. Auth</a>
      <a class="hover:underline hover:underline-offset-4" href="#movement-3">III. Install</a>
      <a class="inline-flex self-center opacity-80 hover:opacity-100" href="https://github.com/acoyfellow/odds" aria-label="Source on GitHub"><svg class="h-[1.15em] w-[1.15em] fill-current" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
    </nav>
  </header>

  <section class="pt-[clamp(1rem,4vh,2.5rem)] text-center">
    <p class="m-0 italic text-faded">for Pi codemode &amp; Cloudflare Clef</p>
    <h1 class="m-0 text-[clamp(4rem,11vw,8.5rem)] font-normal italic leading-[.9] tracking-[-.035em]">odds</h1>
    <p class="m-0 mt-1 text-[1.15rem] tracking-[.14em] [font-variant:small-caps]">Ask for odds, not prose.</p>
  </section>

  <ScoreFilm {queue} {notes} {returned} bind:focus />
  <p class="mb-0 mt-4 mx-auto min-h-[3.2em] max-w-[46rem] text-center italic text-faded">
      {#if focus}
        {@const note = notes.find((candidate) => candidate.row.id === focus)}
        <span class="font-mono text-[.8em] not-italic text-seal">{note.row.id}</span> {note.row.title}.
        Urgent {percent(note.urgent)}, tone <em>{note.tone}</em>{note.rest ? `, injection ${percent(note.injection)}: held back` : ''}.
      {:else}
        Each ticket is a note. Height is the odds it is urgent. Solid notes are angry, open notes are calm.
        The rest is a prompt injection that never reaches the model. Recorded run, {queue.recordedAt.slice(0, 10)}, ${queue.costUsd.toFixed(4)}.
      {/if}
    </p>


  <section class="mx-auto mt-14 max-w-[34rem]">
    <h2 class="mb-5 text-center text-[1.2rem] font-normal tracking-[.1em] [font-variant:small-caps]">Returned to the frontier model</h2>
    <ol class="m-0 list-none p-0 [counter-reset:item]">
      {#each returned as note (note.row.id)}
        <li class="flex items-baseline gap-2 py-1 [counter-increment:item] before:w-9 before:text-faded before:[content:counter(item,upper-roman)'.'] before:[font-variant:small-caps]">
          <span class="leader-dots flex flex-1 gap-2">{note.row.title}</span>
          <span class="font-mono text-[.85rem]" class:text-seal={note.rest}>{note.rest ? 'held' : percent(note.urgent)}</span>
        </li>
      {/each}
    </ol>
  </section>

  {#snippet movement(id, numeral, title)}
    <h2 {id} class="mb-6 scroll-mt-8 border-t-[3px] border-double border-ink pt-8 text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-tight">
      <span class="mr-1 italic text-seal">{numeral}</span> {@html title}
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
    {@render movement('movement-1', 'I.', 'The agent writes the program. Clef answers the questions.')}
    <ol class="list-decimal pl-6 marker:italic marker:text-seal [&>li]:my-2 [&>li]:pl-1">
      <li><strong>Fetch.</strong> The script calls any Pi tool or MCP server, for example 250 Linear issues.</li>
      <li><strong>Fan out.</strong> <code class="font-mono text-[.78em]">models.classify</code> sends one typed request per item. Pi runs four at a time.</li>
      <li><strong>Check.</strong> Labels must be known, the choice must be the argmax, probabilities must sum to 1. Any other answer fails closed.</li>
      <li><strong>Decide in code.</strong> Plain JavaScript filters and sorts. Only the result returns to the frontier model.</li>
    </ol>
    {@render listing(code.snippet, 'snippet', snippet, 'codemode')}
    <p class="italic text-faded">
      {#each models as model, index (model.id)}{index ? ' · ' : ''}<code class="font-mono text-[.78em] not-italic">odds/{model.id}</code> ${model.inputUsdPerMillion}/M input{/each}
    </p>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render movement('movement-2', 'II.', 'Your gateway. Your scoped token. Nothing public.')}
    <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]">
      {#each authRows as [term, detail] (term)}
        <dt class="tracking-wide [font-variant:small-caps]">{term}</dt><dd class="m-0">{detail}</dd>
      {/each}
    </dl>
    <p class="italic text-faded">The token lives in Keychain under <code class="font-mono text-[.78em] not-italic">odds-gateway</code>.</p>
  </section>

  <section class="mx-auto mt-24 max-w-[46rem]">
    {@render movement('movement-3', 'III.', 'Two minutes, then <code class="font-mono text-[.8em]">/reload</code>.')}
    <p>Make a Cloudflare API token with <code class="font-mono text-[.78em]">AI Gateway: Run</code> and <code class="font-mono text-[.78em]">Workers AI: Read</code> on the gateway account. Turn on codemode with <code class="font-mono text-[.78em]">"defaultTools": ["+codemode"]</code>.</p>
    {@render listing(code.install, 'install', install, 'shell')}
    <p class="italic text-faded"><span class="not-italic text-seal [font-variant:small-caps]">Fine.</span> Clef is not a chat model and not an authority. Odds are evidence; your code decides. <code class="font-mono text-[.78em] not-italic">bun run prove:auth</code> checks that anonymous and forged calls are rejected.</p>
  </section>

  <footer class="mx-auto mt-28 border-t border-ink pt-5 text-center text-[.95rem] italic text-faded">
    Set in EB Garamond. odds 0.0.1, MIT. Clef by Cloudflare Workers AI. <a href="https://github.com/acoyfellow">@acoyfellow</a>
  </footer>
</main>
