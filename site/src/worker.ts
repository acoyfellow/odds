import { Hono } from 'hono';
import { attachSvelteRoutes, svelteRenderer } from 'svelte-hono';
import { ODDS_MODELS } from '../../src/models.ts';
import { bundles } from './bundles.generated.ts';
import Docs from './Docs.svelte';
import { DEMO_QUEUE } from './demo-data.ts';

const app = new Hono();
attachSvelteRoutes(app, { bundles });

const head = `
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="odds: Clef decision models in Pi codemode, through your own Cloudflare AI Gateway." />
<meta property="og:title" content="odds — ask for odds, not prose" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />`;

const staticHeaders = {
  'cache-control': 'public, max-age=300',
  'content-security-policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

app.use('*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(staticHeaders)) c.res.headers.set(name, value);
});

app.get(
  '/',
  svelteRenderer(Docs, {
    hydrateAs: 'docs',
    title: 'odds — ask for odds, not prose',
    head,
    props: { queue: DEMO_QUEUE, models: ODDS_MODELS },
  }),
);

app.all('/api/*', (c) => c.json({ error: 'odds.coey.dev is documentation only' }, 404));

export default app;
