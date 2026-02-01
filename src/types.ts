import type { D1Database, VectorizeIndex } from '@cloudflare/workers-types';
import type { SecretsStoreSecret } from './secrets';

export interface Env {
  // Browser rendering binding
  BROWSER?: Fetcher;
  CDP_SECRET?: string;
  WORKER_URL?: string;

  // Memory API config
  MEMORY_API_SECRET?: string;
  MEMORY_EMBEDDING_MODEL?: string;

  // OpenAI key (plain or Secrets Store binding)
  OPENAI_API_KEY?: string | SecretsStoreSecret;

  // D1 + Vectorize bindings
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
}

export type AppEnv = {
  Bindings: Env;
};
