# d1-vec-cfbrowser-worker

![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin%20%2B%20skill-brightgreen)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020)

All-in-one bundle for OpenClaw:

- **Worker**: D1 + Vectorize memory API + Cloudflare Browser Rendering CDP shim
- **Plugin**: memory-d1 (OpenClaw memory plugin)
- **Skill**: cloudflare-browser

## What you get
- `POST /memory/store`
- `POST /memory/recall`
- `POST /memory/forget`
- `GET /cdp` WebSocket endpoint (CDP)

## Install (OpenClaw)
Point your config to the plugin in this repo:

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

Set env vars for browser skill:
```
WORKER_URL=https://<worker>
CDP_SECRET=...
```

Optional memory embedding overrides:
```
EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_API_KEY=...
MEMORY_EMBEDDING_MODEL=baai/bge-m3
```

## Deploy Worker
```
cd d1-vec-cfbrowser-worker
npm install
wrangler d1 migrations apply DB --remote
wrangler deploy
```

## Secrets
```
wrangler secret put MEMORY_API_SECRET
wrangler secret put CDP_SECRET
wrangler secret put EMBEDDING_API_KEY
```

Hub metadata: openclaw.hub.json
