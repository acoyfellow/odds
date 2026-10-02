<script>
  import { onMount, tick } from 'svelte';
  import {
    captionOpacity,
    FILM_CAPTIONS,
    FILM_END,
    LEFT,
    LINE_GAP,
    MID_Y,
    noteFrame,
    resultFrame,
    RIGHT,
    STAFF_BOTTOM,
    STAFF_TOP,
    crossedChimes,
    lerp,
    morphFrame,
    scheduleSpans,
    traceLayout,
    TRACE_LEFT,
    TRACE_RIGHT,
    TRACE_ROW_GAP,
    TRACE_ROW_TOP,
    scrollProgress,
    stageFrame,
    staffFrame,
    titleFrame,
    wavePath,
  } from './film.ts';
  import { createChimes, pitchForY } from './chime.ts';

  let { queue, notes, returned, focus = $bindable(null), children } = $props();

  let stage;

  let t = $state(0);

  let open = $state(0);

  let sound = $state(false);

  let playChime = null;

  let reduced = $state(true);

  const returnedIds = new Set(returned.map((note) => note.row.id));

  const filmNotes = notes.map((note, index) => ({
    index,
    x: note.x,
    y: note.y,
    filled: note.tone !== 'none',
    rest: note.rest,
    returned: returnedIds.has(note.row.id),
  }));

  const CLEF_CONCURRENCY = 4;

  const PER_CALL_MS = Math.round(queue.elapsedMs / Math.ceil(notes.length / CLEF_CONCURRENCY));

  const perCallCost = queue.costUsd / notes.length;

  const spans = scheduleSpans(
    notes.map((note, index) => PER_CALL_MS * (0.78 + ((index * 37) % 11) / 25)),
    CLEF_CONCURRENCY,
  );

  const traceTotalMs = Math.max(...spans.map((span) => span.startMs + span.durationMs));

  const layouts = spans.map((span, index) => traceLayout(index, span, traceTotalMs));

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((share) => ({
    x: TRACE_LEFT + share * (TRACE_RIGHT - TRACE_LEFT),
    label: `${Math.round(share * traceTotalMs)} ms`,
  }));

  const staff = $derived(staffFrame(t));

  const morph = $derived(morphFrame(t));

  const frames = $derived(filmNotes.map((note) => noteFrame(note, t)));

  const result = $derived(resultFrame(t));

  const finished = $derived(t >= FILM_END);

  function ledgerLines(y) {
    const lines = [];

    for (let line = STAFF_TOP - LINE_GAP; line >= y - 2; line -= LINE_GAP) lines.push(line);

    for (let line = STAFF_BOTTOM + LINE_GAP; line <= y + 2; line += LINE_GAP) lines.push(line);

    return lines;
  }

  function percent(value) {
    return `${Math.round(value * 100)}%`;
  }

  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) return;

    const update = () => {
      const box = stage.getBoundingClientRect();
      const stageTop = box.top + window.scrollY;
      const frame = stageFrame(scrollProgress(window.scrollY, stageTop, box.height, window.innerHeight));

      if (sound && playChime) {
        for (const index of crossedChimes(notes.length, t, frame.t)) {
          const note = notes[index];

          playChime({ frequency: pitchForY(note.y), bright: note.tone !== 'none', muted: note.rest });
        }
      }

      open = frame.open;
      t = frame.t;
    };

    tick().then(update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  });
</script>

<div bind:this={stage} class="relative" class:h-[300vh]={!reduced} data-film-t={Math.round(t)} data-film-open={open.toFixed(2)}>
  <figure
    class="m-0 flex flex-col items-stretch justify-center overflow-hidden"
    class:sticky={!reduced}
    style={reduced ? '' : `top:${(1 - open) * 25}vh;height:${50 + open * 50}vh`}
    aria-label="Sixteen support tickets judged by Clef, drawn as notes on a staff"
  >
    <button
      class="absolute right-0 top-2 z-10 cursor-pointer border-0 bg-transparent font-serif text-base italic text-seal hover:underline"
      class:hidden={reduced}
      aria-pressed={sound}
      onclick={() => {
        playChime ??= createChimes();
        sound = !sound;
      }}
    >{sound ? 'sound on' : 'sound off'}</button>
    <svg class="score-svg h-auto max-h-[40vh] w-full overflow-visible" viewBox="0 0 1500 330" role="img">
      <text class="fill-ink font-serif text-[22px] font-semibold italic" opacity={staff.headingOpacity} x="20" y="28">
        Example: {queue.rows.length} support tickets, one question each: “does this need an engineer today?”
      </text>

      {#if !finished}
        {#each queue.rows as row, index (row.id)}
          {@const title = titleFrame(index, t)}
          {#if title.opacity > 0.001}
            <g opacity={title.opacity}>
              <text class="fill-ink font-mono text-[16px]" x={title.x} y={title.y}>{row.title}</text>
              <path class="fill-none stroke-faded" stroke-width="1" opacity={title.waveOpacity / 0.55} d={wavePath(title.x + 300, 160, title.y - 5, 2, t / 140)} />
            </g>
          {/if}
        {/each}
      {/if}

      <g opacity={morph.staffFade}>
      {#each staff.lineY as y, line (line)}
        <line class="staff" opacity={staff.lineOpacity[line]} x1="20" x2={line === 2 ? staff.centerLineX2 : 1480} y1={y} y2={y} />
      {/each}
      <g opacity={staff.barOpacity}>
        <line class="bar-line" x1="20" x2="20" y1={STAFF_TOP} y2={STAFF_BOTTOM} />
        <line class="bar-line" x1="1472" x2="1472" y1={STAFF_TOP} y2={STAFF_BOTTOM} />
        <line class="bar-line thick" x1="1480" x2="1480" y1={STAFF_TOP} y2={STAFF_BOTTOM} />
      </g>
      </g>
      <text class="fill-ink font-music text-[128px]" opacity={staff.clefOpacity * morph.staffFade} x="34" y={STAFF_BOTTOM + 14}>𝄞</text>
      {#each [[1, 'yes, 100%'], [0.5, '50%'], [0, 'no, 0%']] as [odds, label] (label)}
        <text class="fill-faded font-mono text-[13px]" opacity={staff.axisOpacity * morph.staffFade} x="138" y={STAFF_BOTTOM + LINE_GAP - odds * LINE_GAP * 6 + 4} text-anchor="end">{label}</text>
      {/each}

      <text class="fill-seal font-mono text-[15px]" opacity={staff.clefLabelOpacity} x="40" y={MID_Y + 5}>clef</text>
      <rect class="fill-seal" opacity={staff.scanOpacity} x={staff.scanX - 1} y={MID_Y - 40} width="2" height="80" />

      {#if morph.chromeOpacity > 0.001}
        <g opacity={morph.chromeOpacity}>
          <rect class="fill-paper-deep/60 stroke-ink" stroke-width="1" x="20" y="-2" width="1460" height="332" rx="6" />
          <line class="stroke-ink" stroke-width="1" x1="20" x2="1480" y1="22" y2="22" />
          <text class="fill-ink font-mono text-[13px]" x="36" y="15">codemode · trace</text>
          <text class="fill-faded font-mono text-[13px]" x="1464" y="15" text-anchor="end">{notes.length} × models.classify(odds/clef) · concurrency {CLEF_CONCURRENCY}</text>
          <text class="fill-faded font-mono text-[11px]" x="36" y="37">span</text>
          {#each axisTicks as tick (tick.x)}
            <line class="stroke-faded" stroke-width=".6" stroke-dasharray="2 3" x1={tick.x} x2={tick.x} y1="28" y2={TRACE_ROW_TOP + notes.length * TRACE_ROW_GAP} />
            <text class="fill-faded font-mono text-[11px]" x={tick.x} y="37" text-anchor="middle">{tick.label}</text>
          {/each}
          <g opacity={morph.summaryOpacity}>
            <line class="stroke-ink" stroke-width="1" x1="20" x2="1480" y1="306" y2="306" />
            <text class="fill-ink font-mono text-[13px]" x="36" y="322">→ returned to agent: {returned.length} items · {queue.frontierInputTokensEstimate.toLocaleString('en-US')} tokens</text>
            <text class="fill-faded font-mono text-[13px]" x="1464" y="322" text-anchor="end">clef read {queue.inputTokens.toLocaleString('en-US')} tokens · ${queue.costUsd.toFixed(4)} · {(queue.elapsedMs / 1000).toFixed(1)} s wall</text>
          </g>
        </g>
      {/if}

      {#each notes as note, index (note.row.id)}
        {@const frame = frames[index]}
        {@const lane = layouts[index]}
        {#if morph.amount > 0.001}
          {@const rowX = lerp(frame.cx, lane.barX, morph.amount)}
          {@const rowY = lerp(frame.cy, lane.rowY, morph.amount)}
          <g class:focus={focus === note.row.id}>
            <rect
              class:fill-seal={note.rest}
              class:fill-ink={!note.rest && note.tone !== 'none'}
              class:fill-faded={!note.rest && note.tone === 'none'}
              x={rowX - lerp(12, 0, morph.amount)}
              y={rowY - lerp(8.5, 5, morph.amount)}
              width={lerp(24, lane.barWidth, morph.barGrow)}
              height={lerp(17, 10, morph.amount)}
              rx={lerp(9, 2, morph.amount)}
              opacity={note.tone === 'none' && !note.rest ? lerp(1, 0.45, morph.amount) : 1}
            />
            <g opacity={morph.labelOpacity}>
              <text class="fill-faded font-mono text-[12px]" x="36" y={lane.rowY + 4}>{note.row.id}</text>
              <text class="font-mono text-[12px]" class:fill-seal={note.rest} class:fill-ink={!note.rest} x="96" y={lane.rowY + 4}>{note.row.title.slice(0, 30)}</text>
              <text class="font-mono text-[11px]" class:fill-seal={note.rest} class:fill-faded={!note.rest} x={lane.barX + lane.barWidth + 8} y={lane.rowY + 4}>{note.rest ? `injection ${percent(note.injection)} · held` : `urgent ${percent(note.urgent)}`} · {Math.round(spans[index].durationMs)} ms · ${perCallCost.toFixed(5)}</text>
            </g>
          </g>
        {/if}
        <g opacity={morph.staffFade}>
        <g
          class="note cursor-pointer outline-none"
          class:filled={note.tone !== 'none'}
          class:focus={focus === note.row.id}
          opacity={frame.opacity}
          role="button"
          tabindex="0"
          aria-label="{note.row.id} {note.row.title}: urgent {percent(note.urgent)}, tone {note.tone}"
          onmouseenter={() => (focus = note.row.id)}
          onmouseleave={() => (focus = null)}
          onfocus={() => (focus = note.row.id)}
          onblur={() => (focus = null)}
        >
          {#if frame.waveOpacity > 0.001}
            <path class="fill-none stroke-ink" stroke-width="1.2" opacity={frame.waveOpacity} d={wavePath(frame.cx - 26, 52, STAFF_TOP - 60, frame.waveAmplitude, t / 90)} />
          {/if}
          {#if frame.dotOpacity > 0.001}
            <circle class:fill-seal={frame.alarmed} class:fill-faded={!frame.alarmed} cx={frame.cx} cy={frame.cy} r="5" opacity={frame.dotOpacity} />
          {/if}
          {#if note.rest}
            <text class="fill-seal font-music text-[54px]" opacity={frame.restOpacity} x={note.x - 9} y={STAFF_TOP + LINE_GAP * 2.6}>𝄽</text>
            <text class="fill-seal font-serif text-[20px] italic" opacity={frame.markingOpacity} x={note.x} y={STAFF_TOP - 40} text-anchor="middle">injection</text>
          {:else}
            <g opacity={frame.stemOpacity}>
              {#each ledgerLines(note.y) as ledger (ledger)}
                <line class="ledger" x1={note.x - 18} x2={note.x + 18} y1={ledger} y2={ledger} />
              {/each}
            </g>
            <ellipse
              class="head"
              opacity={frame.headOpacity}
              cx={frame.cx}
              cy={frame.cy}
              rx={12 * frame.headScale}
              ry={8.5 * frame.headScale}
              transform="rotate(-20 {frame.cx} {frame.cy})"
            />
            <line class="stem" opacity={frame.stemOpacity} x1={frame.cx + 11} x2={frame.cx + 11} y1={frame.cy - 3} y2={frame.cy - 62} />
            {#if note.tone !== 'none'}
              <text class="fill-ink font-serif text-[17px] italic" opacity={frame.dynamicOpacity} x={note.x} y={STAFF_BOTTOM + 70} text-anchor="middle">{note.tone === 'high' ? 'angry' : 'annoyed'}</text>
            {/if}
          {/if}
          <text class="ticket fill-faded font-mono text-[13px]" opacity={frame.idOpacity} x={note.x} y={STAFF_BOTTOM + 104} text-anchor="middle">{note.row.id.replace('OD-', '')}</text>
        </g>
        </g>
      {/each}

      <rect class="fill-seal" opacity={staff.playheadOpacity * 0.6 * morph.staffFade} x={staff.playheadX - 1} y={STAFF_TOP - 70} width="2" height={LINE_GAP * 4 + 140} />

    </svg>

    <div class="relative mx-auto mt-2 h-[3.4em] w-full max-w-[46rem] text-center text-[1.2rem] italic">
      {#if result.opacity > 0.001}
        <div class="absolute inset-x-0 top-12 font-mono text-[.8rem] not-italic" style="opacity:{result.opacity};transform:translateY({result.shiftX / 3}px)">
          {#each returned as note (note.row.id)}
            <div class:text-seal={note.rest}>{note.row.id} {note.row.title}</div>
          {/each}
          <div class="mt-1 text-faded">clef read {Math.round(queue.inputTokens * result.countProgress).toLocaleString('en-US')} tokens · the large model read {Math.round(queue.frontierInputTokensEstimate * result.countProgress).toLocaleString('en-US')}</div>
        </div>
      {/if}
      {#if reduced}
        <p class="m-0 text-faded">{FILM_CAPTIONS.map((caption) => caption.text).join(' ')}</p>
      {:else}
        {#each FILM_CAPTIONS as caption (caption.text)}
          <p class="absolute inset-x-0 top-0 m-0 text-ink" style="opacity:{captionOpacity(caption, t)}">{caption.text}</p>
        {/each}
      {/if}
    </div>
  </figure>
</div>

