# Cloudflare Browser (CDP)

Use Cloudflare Browser Rendering via CDP from OpenClaw.

## Requirements
- A Cloudflare Worker that exposes `/cdp` with Browser Rendering binding.
- `CDP_SECRET` configured on the Worker.

This repo includes a ready-to-deploy Worker:
- Worker: `d1-vec-cfbrowser-worker`
- Routes: `/cdp`, `/cdp/json/version`, `/cdp/json/list`

## Environment variables
Set these in OpenClaw:

```
WORKER_URL=https://<your-worker>
CDP_SECRET=... (same as Worker secret)
```

## Quick test
```
curl "https://<your-worker>/cdp/json/version?secret=<CDP_SECRET>"
```

If you get JSON with `webSocketDebuggerUrl`, CDP is working.

## Notes
- If Cloudflare Access protects the Worker, use Access Service Tokens or a bypass host.
- The CDP endpoint expects a `?secret=...` query param.
