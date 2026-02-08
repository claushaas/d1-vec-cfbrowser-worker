# Security

- Do not commit secrets. Use `wrangler secret put`.
- The memory API is HMAC-protected by `MEMORY_API_SECRET`.
- Embeddings require an API key (e.g. `EMBEDDING_API_KEY` or `OPENAI_API_KEY`).
