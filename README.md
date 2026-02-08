# d1-vec-cfbrowser-worker

![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-brightgreen)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020)

Cloudflare Worker that exposes a long-term memory API backed by D1 + Vectorize:
- Worker exposes Memory API backed by D1 + Vectorize (`/memory/store`, `/memory/recall`, `/memory/forget`)
- OpenClaw memory plugin lives in a separate repo (install via `npm install`): `openclaw-plugin-memory-d1`

## Required bindings (wrangler.jsonc)
- D1: `DB`
- Vectorize: `VECTORIZE`

## Required secrets
Set via `wrangler secret put`:
- `MEMORY_API_SECRET` (HMAC auth for memory routes)
- `EMBEDDING_API_KEY` (used for embeddings via OpenRouter), or set `OPENAI_API_KEY` instead

Optional:
- `MEMORY_EMBEDDING_MODEL` (default: `baai/bge-m3`)
- `EMBEDDING_BASE_URL` (default: `https://openrouter.ai/api/v1`)
- `OPENAI_API_KEY` (still supported as fallback)

## Local dev
1) Install deps: `npm install`
2) Put secrets in `.dev.vars`
3) Run: `npm run dev`

## Migrations
Apply D1 migrations:
```
wrangler d1 migrations apply DB
```

## Health
`GET /` returns a list of routes.

## OpenClaw integration

Install the OpenClaw memory plugin (separate repo), then point it at this Worker:

```bash
npm install git+ssh://git@github.com/<your-user>/openclaw-plugin-memory-d1.git
```

OpenClaw config example:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/path/to/node_modules/memory-d1"
      ]
    },
    "slots": {
      "memory": "memory-d1"
    },
    "entries": {
      "memory-d1": {
        "enabled": true,
        "config": {
          "memoryApiUrl": "https://<worker>/memory",
          "autoRecall": true,
          "autoCapture": true,
          "recallLimit": 5,
          "minScore": 0.3
        }
      }
    }
  }
}
```

See README_HUB.md for hub listing details.

See SECURITY.md for secret handling.
