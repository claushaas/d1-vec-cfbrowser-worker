#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const INDEX_NAME = process.env.VECTORIZE_INDEX || "bb_memory_vec_dev_768";
const EMBED_BASE_URL = (process.env.EMBEDDING_BASE_URL || "https://nomic-embed.claushaas.dev/v1").replace(/\/$/, "");
const EMBED_MODEL = process.env.MEMORY_EMBEDDING_MODEL || "nomic-ai_nomic-embed-text-v1.5-GGUF_nomic-embed-text-v1.5.Q4_K_M.gguf";
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 256);
const EMBED_BATCH = Number(process.env.EMBED_BATCH || 64);

function runWranglerJson(args) {
  const out = execFileSync("wrangler", args, { encoding: "utf8" });
  return JSON.parse(out);
}

function d1Query(sql) {
  const res = runWranglerJson(["d1", "execute", "DB", "--remote", "--command", sql, "--json"]);
  return res?.[0]?.results || [];
}

async function embedTexts(texts) {
  const res = await fetch(`${EMBED_BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (res.ok) {
    const data = await res.json();
    return data?.data?.map((d) => d.embedding) || [];
  }

  const body = await res.text();
  if (!body.includes("too large")) {
    throw new Error(`Embeddings failed: ${res.status} ${body}`);
  }

  const embeddings = [];
  for (const text of texts) {
    const variants = [text, text.slice(0, 8000), text.slice(0, 4000), text.slice(0, 2000), text.slice(0, 1000)];
    let embedded = null;
    for (const candidate of variants) {
      const single = await fetch(`${EMBED_BASE_URL}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: candidate }),
      });
      if (single.ok) {
        const data = await single.json();
        embedded = data?.data?.[0]?.embedding || null;
        if (candidate.length !== text.length) {
          console.warn(`Truncated input from ${text.length} to ${candidate.length} chars for embedding.`);
        }
        break;
      }
      const singleBody = await single.text();
      if (!singleBody.includes("too large")) {
        throw new Error(`Embeddings failed: ${single.status} ${singleBody}`);
      }
    }
    if (!embedded) {
      throw new Error("Embeddings failed after truncation attempts.");
    }
    embeddings.push(embedded);
  }
  return embeddings;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const countRows = d1Query("SELECT COUNT(*) as count FROM memory_items");
  const total = Number(countRows?.[0]?.count || 0);
  if (!total) {
    console.log("No memory_items found. Nothing to reindex.");
    return;
  }

  console.log(`Reindexing ${total} items into ${INDEX_NAME}`);
  let offset = Number(process.env.START_OFFSET || 0);
  let processed = 0;

  while (offset < total) {
    const rows = d1Query(
      `SELECT id, text, category, importance, created_at FROM memory_items ORDER BY created_at ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    );
    if (!rows.length) break;

    const batches = chunk(rows, EMBED_BATCH);
    const vectors = [];

    for (const batch of batches) {
      const texts = batch.map((r) => r.text);
      const embeddings = await embedTexts(texts);
      if (embeddings.length !== batch.length) {
        throw new Error(`Embedding count mismatch: got ${embeddings.length}, expected ${batch.length}`);
      }
      for (let i = 0; i < batch.length; i += 1) {
        const row = batch[i];
        vectors.push({
          id: row.id,
          values: embeddings[i],
          metadata: {
            category: row.category,
            importance: row.importance,
            created_at: row.created_at,
          },
        });
      }
    }

    const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n") + "\n";
    const filePath = join(tmpdir(), `vectorize-reindex-${offset}.ndjson`);
    writeFileSync(filePath, ndjson, "utf8");

    execFileSync(
      "wrangler",
      ["vectorize", "upsert", INDEX_NAME, "--file", filePath, "--batch-size", "1000"],
      { stdio: "inherit" },
    );

    processed += rows.length;
    offset += rows.length;
    console.log(`Progress: ${processed}/${total}`);
  }

  console.log("Reindex complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
