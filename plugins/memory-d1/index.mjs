import { Type } from "@sinclair/typebox";
import { createHmac } from "node:crypto";

const MEMORY_CATEGORIES = ["profile", "preference", "project", "telos", "security", "other"];

const memoryD1Plugin = {
  id: "memory-d1",
  name: "Memory (D1 + Vectorize)",
  description: "D1 + Vectorize-backed memory via Worker API",
  kind: "memory",

  register(api) {
    const cfg = api.pluginConfig || {};
    const memoryApiUrl = String(cfg.memoryApiUrl || "").trim();
    if (!memoryApiUrl) {
      api.logger.error("memory-d1: missing memoryApiUrl");
      return;
    }

    const secret = process.env.MEMORY_API_SECRET || "";
    if (!secret) {
      api.logger.error("memory-d1: MEMORY_API_SECRET not set in env");
      return;
    }

    const autoRecall = cfg.autoRecall !== false;
    const autoCapture = cfg.autoCapture !== false;
    const recallLimit = Number.isFinite(cfg.recallLimit) ? cfg.recallLimit : 5;
    const minScore = Number.isFinite(cfg.minScore) ? cfg.minScore : 0.3;

    api.logger.info(`memory-d1: plugin registered (autoRecall=${autoRecall}, autoCapture=${autoCapture})`);

    async function callMemoryApi(pathSuffix, payload) {
      const base = new URL(memoryApiUrl);
      const path = `${base.pathname.replace(/\/$/, "")}${pathSuffix}`;
      const url = new URL(path, base.origin);
      const body = JSON.stringify(payload ?? {});
      const timestamp = Date.now().toString();
      const signature = createHmac("sha256", secret)
        .update(`POST\n${path}\n${timestamp}\n${body}`)
        .digest("hex");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-memory-timestamp": timestamp,
          "x-memory-signature": signature,
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`memory API error ${res.status}: ${text}`);
      }
      return res.json();
    }

    api.registerTool(
      {
        name: "memory_recall",
        label: "Memory Recall",
        description: "Search long-term memories stored in D1 + Vectorize.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query" }),
          limit: Type.Optional(Type.Number({ description: "Max results (default: 5)" })),
        }),
        async execute(_toolCallId, params) {
          const { query, limit = recallLimit } = params;
          const result = await callMemoryApi("/recall", {
            query,
            limit,
            minScore,
          });
          if (!result?.results?.length) {
            return {
              content: [{ type: "text", text: "No relevant memories found." }],
              details: { count: 0 },
            };
          }
          const text = result.results
            .map((r, i) => `${i + 1}. [${r.category}] ${r.text} (${(r.score * 100).toFixed(0)}%)`)
            .join("\n");
          return {
            content: [{ type: "text", text: `Found ${result.results.length} memories:\n\n${text}` }],
            details: { count: result.results.length, memories: result.results },
          };
        },
      },
      { name: "memory_recall" },
    );

    api.registerTool(
      {
        name: "memory_store",
        label: "Memory Store",
        description: "Store important facts in long-term memory.",
        parameters: Type.Object({
          text: Type.String({ description: "Information to remember" }),
          importance: Type.Optional(Type.Number({ description: "Importance 0-1 (default: 0.7)" })),
          category: Type.Optional(Type.String({ description: "Category", enum: MEMORY_CATEGORIES })),
        }),
        async execute(_toolCallId, params) {
          const { text, importance = 0.7, category = "other" } = params;
          const result = await callMemoryApi("/store", {
            text,
            importance,
            category,
          });
          if (result.status === "duplicate") {
            return {
              content: [{ type: "text", text: "Similar memory already exists." }],
              details: result,
            };
          }
          return {
            content: [{ type: "text", text: "Memory stored." }],
            details: result,
          };
        },
      },
      { name: "memory_store" },
    );

    api.registerTool(
      {
        name: "memory_forget",
        label: "Memory Forget",
        description: "Delete memories by id or query.",
        parameters: Type.Object({
          query: Type.Optional(Type.String({ description: "Search query to find memory" })),
          memoryId: Type.Optional(Type.String({ description: "Specific memory ID" })),
        }),
        async execute(_toolCallId, params) {
          const { query, memoryId } = params;
          const result = await callMemoryApi("/forget", {
            id: memoryId,
            query,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            details: result,
          };
        },
      },
      { name: "memory_forget" },
    );

    if (autoRecall) {
      api.on("before_agent_start", async (event) => {
        if (!event.prompt || event.prompt.length < 5) return;
        try {
          const result = await callMemoryApi("/recall", {
            query: event.prompt,
            limit: recallLimit,
            minScore,
          });
          if (!result?.results?.length) return;
          const memoryContext = result.results
            .map((r) => `- [${r.category}] ${r.text}`)
            .join("\n");
          return {
            prependContext: `<relevant-memories>\n${memoryContext}\n</relevant-memories>`,
          };
        } catch (err) {
          api.logger.warn(`memory-d1: recall failed: ${String(err)}`);
        }
      });
    }

    if (autoCapture) {
      api.on("agent_end", async (event) => {
        if (!event.success || !event.messages || event.messages.length === 0) {
          return;
        }
        try {
          const texts = [];
          for (const msg of event.messages) {
            if (!msg || typeof msg !== "object") continue;
            const role = msg.role;
            if (role !== "user" && role !== "assistant") continue;
            const content = msg.content;
            if (typeof content === "string") {
              texts.push(content);
              continue;
            }
            if (Array.isArray(content)) {
              for (const block of content) {
                if (
                  block &&
                  typeof block === "object" &&
                  block.type === "text" &&
                  typeof block.text === "string"
                ) {
                  texts.push(block.text);
                }
              }
            }
          }
          const toCapture = texts.filter((text) => shouldCapture(text)).slice(0, 3);
          for (const text of toCapture) {
            await callMemoryApi("/store", {
              text,
              importance: 0.7,
              category: detectCategory(text),
            });
          }
        } catch (err) {
          api.logger.warn(`memory-d1: capture failed: ${String(err)}`);
        }
      });
    }
  },
};

const MEMORY_EXCLUDE_TRIGGERS = [/password|token|secret/i, /email/i];

function shouldCapture(text) {
  if (!text || text.length < 10) return false;
  if (text.includes("<relevant-memories>")) return false;
  if (text.startsWith("<") && text.includes("</")) return false;
  return !MEMORY_EXCLUDE_TRIGGERS.some((r) => r.test(text));
}

function detectCategory(text) {
  if (/password|token|secret/i.test(text)) return "security";
  if (/prefer|like|love|hate|want|need/i.test(text)) return "preference";
  if (/project|repo|deploy|worker|cloudflare/i.test(text)) return "project";
  if (/telos/i.test(text)) return "telos";
  if (/i am|meu nome|my name/i.test(text)) return "profile";
  return "other";
}

export default memoryD1Plugin;
