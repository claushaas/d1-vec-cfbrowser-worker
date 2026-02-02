# d1-vec-cfbrowser-worker

![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin%20%2B%20skill-brightgreen)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020)

Worker + OpenClaw plugin/skill bundle:
- Worker exposes Memory API backed by D1 + Vectorize (`/memory/store`, `/memory/recall`, `/memory/forget`)
- Worker exposes Cloudflare Browser Rendering CDP shim (`/cdp`)
- OpenClaw memory plugin: `plugins/memory-d1`
- Cloudflare browser skill: `skills/cloudflare-browser`

## Required bindings (wrangler.jsonc)
- D1: `DB`
- Vectorize: `VECTORIZE`
- Browser Rendering: `BROWSER`

## Required secrets
Set via `wrangler secret put`:
- `MEMORY_API_SECRET` (HMAC auth for memory routes)
- `CDP_SECRET` (auth for /cdp websocket)
- `OPENAI_API_KEY` (used for embeddings)

Optional:
- `MEMORY_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- `EMBEDDING_BASE_URL` (default: `https://api.openai.com/v1`)
- `EMBEDDING_API_KEY` (optional, overrides `OPENAI_API_KEY`)

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

Plugin + skill live inside this repo:

- Memory plugin: `plugins/memory-d1`
- Cloudflare browser skill: `skills/cloudflare-browser`

OpenClaw config example:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/path/to/d1-vec-cfbrowser-worker/plugins/memory-d1"
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

Cloudflare browser skill env vars:

```
WORKER_URL=https://<worker>
CDP_SECRET=...
```

See README_HUB.md for hub listing details.

See SECURITY.md for secret handling.
