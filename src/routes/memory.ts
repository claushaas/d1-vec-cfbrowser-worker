import { Hono } from 'hono';
import type { AppEnv } from '../types';
import type { D1Database, VectorizeIndex } from '@cloudflare/workers-types';
import { resolveSecret } from '../secrets';

const memory = new Hono<AppEnv>();

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

type MemoryItem = {
  id: string;
  text: string;
  category: string;
  importance: number;
  createdAt: number;
  source?: string | null;
  tags?: string | null;
};

type VectorizeMatch = {
  id?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

function requireMemoryBindings(env: AppEnv['Bindings']): { db: D1Database; vectorize: VectorizeIndex } {
  if (!env.DB || !env.VECTORIZE) {
    throw new Error('Memory bindings (DB, VECTORIZE) are not configured');
  }
  return { db: env.DB, vectorize: env.VECTORIZE };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyRequestAuth(env: AppEnv['Bindings'], req: Request, bodyText: string): Promise<void> {
  const secret = env.MEMORY_API_SECRET;
  if (!secret) {
    throw new Error('MEMORY_API_SECRET is not configured');
  }

  const timestampRaw = req.headers.get('x-memory-timestamp') || '';
  const signature = req.headers.get('x-memory-signature') || '';
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Invalid timestamp');
  }
  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) {
    throw new Error('Timestamp out of range');
  }

  const url = new URL(req.url);
  const payload = `${req.method}\n${url.pathname}\n${timestampRaw}\n${bodyText}`;
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqual(expected, signature)) {
    throw new Error('Invalid signature');
  }
}

async function embedText(env: AppEnv['Bindings'], text: string): Promise<number[]> {
  const apiKey = await resolveSecret(env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const model = env.MEMORY_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${body}`);
  }
  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  const embedding = data?.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding response missing data');
  }
  return embedding;
}

async function fetchMemoryItems(env: AppEnv['Bindings'], ids: string[]): Promise<Map<string, MemoryItem>> {
  if (ids.length === 0) return new Map();
  const { db } = requireMemoryBindings(env);
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT id, text, category, importance, created_at, source, tags FROM memory_items WHERE id IN (${placeholders})`,
  );
  const result = await stmt.bind(...ids).all<{
    id: string;
    text: string;
    category: string;
    importance: number;
    created_at: number;
    source: string | null;
    tags: string | null;
  }>();
  const map = new Map<string, MemoryItem>();
  for (const row of result.results || []) {
    map.set(row.id, {
      id: row.id,
      text: row.text,
      category: row.category,
      importance: row.importance,
      createdAt: row.created_at,
      source: row.source,
      tags: row.tags,
    });
  }
  return map;
}

memory.post('/store', async (c) => {
  const bodyText = await c.req.text();
  try {
    await verifyRequestAuth(c.env, c.req.raw, bodyText);
  } catch (err) {
    return c.json({ error: String(err) }, 401);
  }

  let payload: { text?: string; importance?: number; category?: string; source?: string; tags?: string[] };
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const text = (payload.text || '').trim();
  if (!text) {
    return c.json({ error: 'text is required' }, 400);
  }

  const importance = typeof payload.importance === 'number' ? payload.importance : 0.7;
  const category = payload.category || 'other';
  const source = payload.source || null;
  const tags = Array.isArray(payload.tags) ? JSON.stringify(payload.tags) : null;

  try {
    const { db, vectorize } = requireMemoryBindings(c.env);
    const vector = await embedText(c.env, text);
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    const duplicateCheck = await vectorize.query(vector, {
      topK: 1,
      returnMetadata: true,
    }) as { matches?: VectorizeMatch[] };
    const top = duplicateCheck.matches?.[0];
    if (top && typeof top.score === 'number' && top.score >= 0.95 && top.id) {
      return c.json({ status: 'duplicate', id: top.id, score: top.score });
    }

    await db.prepare(
      'INSERT INTO memory_items (id, text, category, importance, created_at, source, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, text, category, importance, createdAt, source, tags).run();

    await vectorize.upsert([
      {
        id,
        values: vector,
        metadata: {
          category,
          importance,
          created_at: createdAt,
        },
      },
    ]);

    return c.json({ status: 'stored', id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

memory.post('/recall', async (c) => {
  const bodyText = await c.req.text();
  try {
    await verifyRequestAuth(c.env, c.req.raw, bodyText);
  } catch (err) {
    return c.json({ error: String(err) }, 401);
  }

  let payload: { query?: string; limit?: number; minScore?: number };
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const query = (payload.query || '').trim();
  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  const limit = typeof payload.limit === 'number' ? payload.limit : 5;
  const minScore = typeof payload.minScore === 'number' ? payload.minScore : 0.3;

  try {
    const { vectorize } = requireMemoryBindings(c.env);
    const vector = await embedText(c.env, query);
    const matches = await vectorize.query(vector, {
      topK: limit,
      returnMetadata: true,
    }) as { matches?: VectorizeMatch[] };
    const ids = (matches.matches || []).map((m: VectorizeMatch) => m.id).filter(Boolean) as string[];
    const itemsById = await fetchMemoryItems(c.env, ids);

    const results = (matches.matches || [])
      .filter((m: VectorizeMatch) => typeof m.score === 'number' && m.score >= minScore)
      .map((m: VectorizeMatch) => {
        const matchId = m.id;
        if (!matchId) return null;
        const item = itemsById.get(matchId);
        if (!item) return null;
        return {
          id: item.id,
          text: item.text,
          category: item.category,
          importance: item.importance,
          createdAt: item.createdAt,
          score: m.score,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    return c.json({ results, count: results.length });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

memory.post('/forget', async (c) => {
  const bodyText = await c.req.text();
  try {
    await verifyRequestAuth(c.env, c.req.raw, bodyText);
  } catch (err) {
    return c.json({ error: String(err) }, 401);
  }

  let payload: { id?: string; query?: string; limit?: number; minScore?: number };
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { id } = payload;
  if (id) {
    try {
      const { db, vectorize } = requireMemoryBindings(c.env);
      await db.prepare('DELETE FROM memory_items WHERE id = ?').bind(id).run();
      await vectorize.deleteByIds([id]);
      return c.json({ status: 'deleted', id });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  }

  const query = (payload.query || '').trim();
  if (!query) {
    return c.json({ error: 'id or query is required' }, 400);
  }

  const limit = typeof payload.limit === 'number' ? payload.limit : 5;
  const minScore = typeof payload.minScore === 'number' ? payload.minScore : 0.7;

  try {
    const { db, vectorize } = requireMemoryBindings(c.env);
    const vector = await embedText(c.env, query);
    const matches = await vectorize.query(vector, {
      topK: limit,
      returnMetadata: true,
    }) as { matches?: VectorizeMatch[] };
    const filtered = (matches.matches || [])
      .filter((m: VectorizeMatch) => typeof m.score === 'number' && m.score >= minScore);

    if (filtered.length === 0) {
      return c.json({ status: 'not_found', candidates: [] });
    }

    const soleMatch = filtered[0];
    if (filtered.length === 1 && soleMatch && typeof soleMatch.score === 'number' && soleMatch.score >= 0.9 && soleMatch.id) {
      const deleteId = soleMatch.id;
      await db.prepare('DELETE FROM memory_items WHERE id = ?').bind(deleteId).run();
      await vectorize.deleteByIds([deleteId]);
      return c.json({ status: 'deleted', id: deleteId });
    }

    const ids = filtered.map((m: VectorizeMatch) => m.id).filter(Boolean) as string[];
    const itemsById = await fetchMemoryItems(c.env, ids);
    const candidates = filtered
      .map((m: VectorizeMatch) => {
        const matchId = m.id;
        if (!matchId) return null;
        const item = itemsById.get(matchId);
        if (!item) return null;
        return {
          id: item.id,
          text: item.text,
          category: item.category,
          importance: item.importance,
          createdAt: item.createdAt,
          score: m.score,
        };
      })
      .filter(Boolean);

    return c.json({ status: 'candidates', candidates });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export { memory };
