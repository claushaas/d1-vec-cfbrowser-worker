export type SecretString = string;

export interface SecretsStoreSecret {
  get(): Promise<string>;
}

export function isSecretsStoreSecret(v: unknown): v is SecretsStoreSecret {
  return !!v && typeof v === 'object' && typeof (v as any).get === 'function';
}

export async function resolveSecret(v: unknown): Promise<string | undefined> {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (isSecretsStoreSecret(v)) return await v.get();
  return undefined;
}
