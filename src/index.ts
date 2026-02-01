import { Hono } from 'hono';
import type { AppEnv } from './types';
import { cdp } from './routes/cdp';
import { memory } from './routes/memory';

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({
  ok: true,
  service: 'd1-vec-cfbrowser-worker',
  routes: [
    '/memory/store',
    '/memory/recall',
    '/memory/forget',
    '/cdp',
    '/cdp/json/version',
    '/cdp/json/list'
  ]
}));

app.route('/cdp', cdp);
app.route('/memory', memory);

export default app;
