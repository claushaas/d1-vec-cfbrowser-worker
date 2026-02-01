# memory-d1-vec

Memory plugin for clawdbot/openclawd that stores long‑term memory in Cloudflare D1 + Vectorize via a Worker API.

## Install

Using npm from a Git repo:

```bash
npm install git+ssh://git@github.com/<your-org>/memory-d1-vec.git
```

Or with a local path:

```bash
npm install /Users/claus/Dev/memory-d1-vec
```

## Configure

1) Ensure your Cloudflare Worker exposes the memory API endpoints:
- `POST /memory/store`
- `POST /memory/recall`
- `POST /memory/forget`

2) Set the shared secret in your local environment:

```bash
export MEMORY_API_SECRET="<same-secret-as-worker>"
```

3) Configure the plugin in your `clawdbot.json` (or equivalent) and point it at the Worker:

```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/node_modules/memory-d1-vec"]
    },
    "slots": {
      "memory": "memory-d1"
    },
    "entries": {
      "memory-d1": {
        "enabled": true,
        "config": {
          "memoryApiUrl": "https://<your-worker-domain>/memory",
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

## Notes

- `memoryApiUrl` is required.
- `MEMORY_API_SECRET` must match the Worker config.
- If the Worker is protected by Cloudflare Access, use a Service Token or an Access bypass host.

## Files

- `index.mjs`: plugin implementation
- `clawdbot.plugin.json`: plugin metadata + config schema
