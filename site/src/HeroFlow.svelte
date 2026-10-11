<script>
  import { HERO_RUN } from './hero-data.ts';

  const DURATION_MS = 7000;

  const GRID_COLUMNS = 17;

  const WIDE = {
    width: 1200,
    height: 420,
    grid: { x: 40, y: 96, label: 72, note: 320 },
    packs: { x: 340, y: 92, gap: 48, height: 206, label: 72, note: 320 },
    strip: { x: 790, width: 380, top: 100, spread: 190, axis: 306, held: 338, label: 72, heldLabel: 364 },
    result: 404,
  };

  const NARROW = {
    width: 400,
    height: 900,
    grid: { x: 85, y: 64, label: 40, note: 290 },
    packs: { x: 20, y: 352, gap: 46, height: 206, label: 336, note: 580 },
    strip: { x: 30, width: 340, top: 650, spread: 150, axis: 812, held: 840, label: 630, heldLabel: 866 },
    result: 892,
  };

  let figureWidth = $state(1200);

  const layout = $derived(figureWidth < 640 ? NARROW : WIDE);

  const items = HERO_RUN.rows.map(([id, urgent, injection, truth, planted], index) => {
    const pack = Math.floor(index / HERO_RUN.packSize);
    const slot = index % HERO_RUN.packSize;
    const held = injection >= 0.5;
    const kept = !held && urgent >= HERO_RUN.threshold;

    return {
      id,
      urgent,
      held,
      kept,
      truth: truth === 1,
      planted: planted === 1,
      index,
      pack,
      slot,
      delay: (index % 32) / 32,
    };
  });

  const keptCount = items.filter((item) => item.kept).length;

  const keptTrue = items.filter((item) => item.kept && item.truth).length;

  const heldCount = items.filter((item) => item.held).length;

  const thresholdX = $derived(layout.strip.x + HERO_RUN.threshold * layout.strip.width);

  function anchors(item, l) {
    return {
      grid: { x: l.grid.x + (item.index % GRID_COLUMNS) * 14, y: l.grid.y + Math.floor(item.index / GRID_COLUMNS) * 14 },
      pack: { x: l.packs.x + 4 + item.pack * l.packs.gap + (item.slot % 4) * 9, y: l.packs.y + 12 + Math.floor(item.slot / 4) * 25 },
      scored: {
        x: l.strip.x + item.urgent * l.strip.width,
        y: item.held ? l.strip.held : l.strip.top + ((item.index * 37) % l.strip.spread),
      },
    };
  }

  let t = $state(1);

  const HOLD_MS = 3500;

  const FADE_MS = 600;

  let fade = $state(1);

  $effect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const started = performance.now();

    const tick = (now) => {
      const elapsed = (now - started) % (DURATION_MS + HOLD_MS);

      t = Math.min(1, elapsed / DURATION_MS);
      fade = Math.min(1, elapsed / FADE_MS, (DURATION_MS + HOLD_MS - elapsed) / FADE_MS);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  });

  function phase(start, end, delay = 0) {
    const span = end - start;
    const shifted = start + delay * span * 0.5;
    const value = (t - shifted) / (span * 0.5);

    return Math.max(0, Math.min(1, value));
  }

  function ease(value) {
    return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
  }

  function position(item, l) {
    const { grid, pack, scored } = anchors(item, l);
    const toPack = ease(phase(0.12, 0.38, item.delay));
    const toScore = ease(phase(0.48, 0.78, item.delay));
    const x1 = grid.x + (pack.x - grid.x) * toPack;
    const y1 = grid.y + (pack.y - grid.y) * toPack;

    return { x: x1 + (scored.x - x1) * toScore, y: y1 + (scored.y - y1) * toScore, scored: toScore };
  }

  function fillFor(item, scored) {
    if (scored < 1) return 'var(--color-faded)';

    if (item.held) return 'var(--color-seal)';

    return item.kept ? 'var(--color-ink)' : 'var(--color-faded)';
  }

  const packLabelOpacity = $derived(phase(0.3, 0.45));

  const stripOpacity = $derived(phase(0.45, 0.6));

  const resultOpacity = $derived(phase(0.82, 0.95));

  const packCount = Math.ceil(items.length / HERO_RUN.packSize);
</script>

<figure class="m-0" bind:clientWidth={figureWidth}>
  <svg
    class="mx-auto block h-auto w-full"
    class:max-w-[440px]={layout === NARROW}
    viewBox={`0 0 ${layout.width} ${layout.height}`}
    role="img"
    style:opacity={fade}
    aria-label={`${items.length} real issues go to Clef in ${packCount} calls; ${keptCount} come back as urgent, ${heldCount} are held as injections.`}
  >
    <text class="fill-ink font-mono text-[14px]" x={layout.grid.x} y={layout.grid.label}>{items.length} issues</text>
    <text class="fill-faded font-mono text-[12px]" x={layout.grid.x} y={layout.grid.note}>the agent never reads these</text>

    <g opacity={packLabelOpacity}>
      <text class="fill-ink font-mono text-[14px]" x={layout.packs.x} y={layout.packs.label}>{packCount} calls to clef-flash</text>
      {#each Array.from({ length: packCount }) as _, pack (pack)}
        <rect class="fill-none stroke-ink/40" x={layout.packs.x + pack * layout.packs.gap} y={layout.packs.y} width="40" height={layout.packs.height} rx="3" />
      {/each}
      <text class="fill-faded font-mono text-[12px]" x={layout.packs.x} y={layout.packs.note}>{HERO_RUN.packSize} issues · 64 typed questions per call</text>
    </g>

    <g opacity={stripOpacity}>
      <text class="fill-ink font-mono text-[14px]" x={layout.strip.x} y={layout.strip.label}>odds each issue is urgent</text>
      <line class="stroke-ink" stroke-width="1" x1={layout.strip.x} x2={layout.strip.x + layout.strip.width} y1={layout.strip.axis} y2={layout.strip.axis} />
      {#each [0, 0.5, 1] as tick (tick)}
        <text class="fill-faded font-mono text-[11px]" x={layout.strip.x + tick * layout.strip.width} y={layout.strip.axis + 16} text-anchor="middle">{tick * 100}%</text>
      {/each}
      <line class="stroke-seal" stroke-width="1.5" stroke-dasharray="4 3" x1={thresholdX} x2={thresholdX} y1={layout.strip.top - 14} y2={layout.strip.axis - 6} />
      <text class="fill-seal font-mono text-[11px]" x={thresholdX + 6} y={layout.strip.top - 4}>keep ≥ {HERO_RUN.threshold * 100}%</text>
      <text class="fill-seal font-mono text-[12px]" x={layout.strip.x} y={layout.strip.heldLabel}>injection ≥ 50% · held back</text>
    </g>

    {#each items as item (item.id)}
      {@const at = position(item, layout)}
      <rect
        x={at.x - 4}
        y={at.y - 4}
        width="8"
        height="8"
        rx="1.5"
        fill={fillFor(item, at.scored)}
        opacity={at.scored === 1 && !item.kept && !item.held ? 0.45 : 0.9}
      />
    {/each}

    <g opacity={resultOpacity}>
      {#if layout === NARROW}
        <text class="fill-ink font-mono text-[13px]" x="20" y={layout.result}>→ back to the agent: {keptCount} ids · held {heldCount}</text>
      {:else}
        <text class="fill-ink font-mono text-[14px]" x="40" y={layout.result}>
          → back to the agent: {keptCount} issue ids. Held: {heldCount} injection{heldCount === 1 ? '' : 's'}.
        </text>
        <text class="fill-faded font-mono text-[12px]" x="1170" y={layout.result} text-anchor="end">
          ${HERO_RUN.costUsd.toFixed(4)} · {(HERO_RUN.wallMs / 1000).toFixed(1)} s · recorded {HERO_RUN.recordedAt.slice(0, 10)}
        </text>
      {/if}
    </g>
  </svg>
  <figcaption class="mt-2 text-center text-[.95rem] italic text-faded">
    A real run on the eval's 255 Kubernetes issues{layout === NARROW ? `, $${HERO_RUN.costUsd.toFixed(4)}, ${(HERO_RUN.wallMs / 1000).toFixed(1)} s` : ''}. Each square is one issue, placed at the probability Clef gave it. Of the {keptCount} kept, {keptTrue} are labelled urgent by Kubernetes maintainers.
  </figcaption>
</figure>
