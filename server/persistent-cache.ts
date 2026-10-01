import { d1Enabled, d1Query, ensureSchema } from "./cloudflare";

/**
 * Two-level cache: process memory first, then Cloudflare D1 so lookups survive restarts and
 * deploys. Without D1 credentials it degrades to memory only.
 */
const memory = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

async function readD1(ns: string, key: string) {
  if (!d1Enabled()) return undefined;
  try {
    await ensureSchema();
    const rows = await d1Query<{ value: string; expires_at: number }>("SELECT value, expires_at FROM cache WHERE ns = ? AND key = ? AND expires_at > ?", [ns, key, Date.now()]);
    return rows[0] ? { value: JSON.parse(rows[0].value) as unknown, expiresAt: rows[0].expires_at } : undefined;
  } catch (error) {
    console.warn("[cache] D1 read failed", error instanceof Error ? error.message : error);
    return undefined;
  }
}

function writeD1(ns: string, key: string, value: unknown, expiresAt: number) {
  if (!d1Enabled()) return;
  void ensureSchema()
    .then(() => d1Query("INSERT OR REPLACE INTO cache (ns, key, value, expires_at) VALUES (?, ?, ?, ?)", [ns, key, JSON.stringify(value), expiresAt]))
    .catch((error) => console.warn("[cache] D1 write failed", error instanceof Error ? error.message : error));
}

export async function cachedValue<T>(ns: string, key: string, ttlMs: number, load: () => Promise<T>, shouldStore: (value: T) => boolean = () => true): Promise<T> {
  const id = `${ns}:${key}`;
  const hit = memory.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  let pending = inflight.get(id) as Promise<T> | undefined;
  if (!pending) {
    pending = (async () => {
      const stored = await readD1(ns, key);
      if (stored) {
        memory.set(id, stored);
        return stored.value as T;
      }
      const value = await load();
      if (shouldStore(value)) {
        const expiresAt = Date.now() + ttlMs;
        memory.set(id, { value, expiresAt });
        if (memory.size > 2000) memory.delete(memory.keys().next().value!);
        writeD1(ns, key, value, expiresAt);
      }
      return value;
    })().finally(() => inflight.delete(id));
    inflight.set(id, pending);
  }
  return pending;
}
