# d1-vec-cfbrowser-worker

![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin%20%2B%20skill-brightgreen)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020)

Worker + OpenClaw plugin for OpenClaw:

- **Worker**: D1 + Vectorize memory API
- **Plugin**: memory-d1 (install separately via `npm install` from `openclaw-plugin-memory-d1`)

## What you get
- `POST /memory/store`
- `POST /memory/recall`
- `POST /memory/forget`

## Install (OpenClaw)
Install the plugin, then point your config to it:

```bash
npm install git+ssh://git@github.com/<your-user>/openclaw-plugin-memory-d1.git
```

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
wrangler secret put EMBEDDING_API_KEY
```

Hub metadata: openclaw.hub.json
