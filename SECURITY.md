# Security

- Do not commit secrets. Use `wrangler secret put`.
- The memory API is HMAC-protected by `MEMORY_API_SECRET`.
- The CDP WebSocket is protected by `CDP_SECRET`.
