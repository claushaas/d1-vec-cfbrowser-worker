import { Hono } from 'hono';
import type { AppEnv } from './types';
import { memory } from './routes/memory';

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({
  ok: true,
  service: 'd1-vec-cfbrowser-worker',
  routes: [
    '/memory/store',
    '/memory/recall',
    '/memory/forget',
  ]
}));

app.route('/memory', memory);

export default app;
