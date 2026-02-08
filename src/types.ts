import type { D1Database, VectorizeIndex } from '@cloudflare/workers-types';
import type { SecretsStoreSecret } from './secrets';

export interface Env {
  // Memory API config
  MEMORY_API_SECRET?: string;
  MEMORY_EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
  EMBEDDING_API_KEY?: string | SecretsStoreSecret;

  // OpenAI key (plain or Secrets Store binding)
  OPENAI_API_KEY?: string | SecretsStoreSecret;

  // D1 + Vectorize bindings
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
}

export type AppEnv = {
  Bindings: Env;
};
