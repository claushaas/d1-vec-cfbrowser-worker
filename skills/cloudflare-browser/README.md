# cloudflare-browser-skill

Cloudflare Browser Rendering helpers (CDP over WebSocket) for clawdbot/openclawd.

## Install

```bash
npm install cloudflare-browser-skill
```

Or from a Git repo:

```bash
npm install git+ssh://git@github.com/<your-org>/cloudflare-browser-skill.git
```

## Usage

Set your environment variables:

```bash
export WORKER_URL="https://<your-worker-domain>"
export CDP_SECRET="<your-cdp-secret>"
```

### Screenshot (CLI)

```bash
cf-browser-screenshot https://example.com out.png
```

### Video (CLI)

```bash
cf-browser-video "https://site1.com,https://site2.com" out.mp4
```

### Programmatic

```js
const { createClient } = require('cloudflare-browser-skill/scripts/cdp-client');

(async () => {
  const client = await createClient();
  await client.setViewport(1280, 800);
  await client.navigate('https://example.com');
  const png = await client.screenshot();
  require('fs').writeFileSync('out.png', png);
  client.close();
})();
```

## Configuration

- `WORKER_URL`: Worker domain (without path)
- `CDP_SECRET`: Shared secret for `/cdp` endpoint

## Notes

- The Worker must expose `/cdp` and have a `BROWSER` binding configured.
- If Cloudflare Access protects the Worker, you may need a Service Token or a bypassed host.

## Files

- `SKILL.md`: usage notes and patterns
- `scripts/cdp-client.js`: reusable client
- `scripts/screenshot.js`: CLI screenshot helper
- `scripts/video.js`: CLI video helper
