import { Redis } from "@upstash/redis";

/**
 * Minimal key-value store. Uses Upstash Redis (REST, works on Vercel serverless)
 * when configured, otherwise an in-process memory store for local development.
 * On Vercel, configure Redis: serverless instances do not share memory.
 */
export interface Store {
  readonly kind: "redis" | "memory";
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  /** Returns true if the member was newly added. */
  sadd(key: string, member: string, ttlSec?: number): Promise<boolean>;
  smembers(key: string): Promise<string[]>;
  setnx(key: string, value: string, ttlSec?: number): Promise<boolean>;
  /** Atomic integer counter; returns the new value. */
  incr(key: string, ttlSec?: number): Promise<number>;
  /** Atomic hash field increment; returns the new value. */
  hincrby(key: string, field: string, by: number, ttlSec?: number): Promise<number>;
  hset(key: string, field: string, value: string, ttlSec?: number): Promise<void>;
  /** Values are returned as strings. */
  hgetall(key: string): Promise<Record<string, string>>;
  /** Push to the head of a list, keeping at most `keep` entries. */
  lpush(key: string, value: string, keep: number, ttlSec?: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private kv = new Map<string, { v: string; exp?: number }>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private nums = new Map<string, number>();

  private alive(key: string) {
    const e = this.kv.get(key);
    if (e?.exp && e.exp < Date.now()) {
      this.kv.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T>(key: string) {
    const e = this.alive(key);
    return e ? (JSON.parse(e.v) as T) : null;
  }
  async set<T>(key: string, value: T, ttlSec?: number) {
    this.kv.set(key, { v: JSON.stringify(value), exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
  }
  async mget<T>(keys: string[]) {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  async sadd(key: string, member: string) {
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = new Set()));
    if (s.has(member)) return false;
    s.add(member);
    return true;
  }
  async smembers(key: string) {
    return [...(this.sets.get(key) ?? [])];
  }
  async setnx(key: string, value: string, ttlSec?: number) {
    if (this.alive(key)) return false;
    await this.set(key, value, ttlSec);
    return true;
  }
  async incr(key: string) {
    const v = (this.nums.get(key) ?? 0) + 1;
    this.nums.set(key, v);
    return v;
  }
  private hash(key: string) {
    let h = this.hashes.get(key);
    if (!h) this.hashes.set(key, (h = new Map()));
    return h;
  }
  async hincrby(key: string, field: string, by: number) {
    const h = this.hash(key);
    const v = Number(h.get(field) ?? 0) + by;
    h.set(field, String(v));
    return v;
  }
  async hset(key: string, field: string, value: string) {
    this.hash(key).set(field, value);
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async lpush(key: string, value: string, keep: number) {
    const l = this.lists.get(key) ?? [];
    l.unshift(value);
    this.lists.set(key, l.slice(0, keep));
  }
  async lrange(key: string, start: number, stop: number) {
    return (this.lists.get(key) ?? []).slice(start, stop + 1);
  }
}

/** Upstash auto-parses JSON-looking values; normalise everything back to strings. */
const asString = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

class RedisStore implements Store {
  readonly kind = "redis" as const;
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    return (await this.r.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T, ttlSec?: number) {
    if (ttlSec) await this.r.set(key, value, { ex: ttlSec });
    else await this.r.set(key, value);
  }
  async mget<T>(keys: string[]) {
    if (keys.length === 0) return [];
    const out: (T | null)[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = await this.r.mget<(T | null)[]>(...keys.slice(i, i + 100));
      out.push(...chunk);
    }
    return out;
  }
  async sadd(key: string, member: string, ttlSec?: number) {
    const n = await this.r.sadd(key, member);
    if (ttlSec) await this.r.expire(key, ttlSec);
    return n === 1;
  }
  async smembers(key: string) {
    return (await this.r.smembers(key)) as string[];
  }
  async setnx(key: string, value: string, ttlSec?: number) {
    const res = await this.r.set(key, value, ttlSec ? { nx: true, ex: ttlSec } : { nx: true });
    return res === "OK";
  }
  async incr(key: string, ttlSec?: number) {
    const v = await this.r.incr(key);
    if (ttlSec && v === 1) await this.r.expire(key, ttlSec);
    return v;
  }
  async hincrby(key: string, field: string, by: number, ttlSec?: number) {
    const v = await this.r.hincrby(key, field, by);
    if (ttlSec) await this.r.expire(key, ttlSec);
    return v;
  }
  async hset(key: string, field: string, value: string, ttlSec?: number) {
    await this.r.hset(key, { [field]: value });
    if (ttlSec) await this.r.expire(key, ttlSec);
  }
  async hgetall(key: string) {
    const h = (await this.r.hgetall<Record<string, unknown>>(key)) ?? {};
    return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, asString(v)]));
  }
  async lpush(key: string, value: string, keep: number, ttlSec?: number) {
    await this.r.lpush(key, value);
    await this.r.ltrim(key, 0, keep - 1);
    if (ttlSec) await this.r.expire(key, ttlSec);
  }
  async lrange(key: string, start: number, stop: number) {
    return ((await this.r.lrange(key, start, stop)) as unknown[]).map(asString);
  }
}

const g = globalThis as unknown as { __cnStore?: Store };

export function store(): Store {
  if (g.__cnStore) return g.__cnStore;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  g.__cnStore = url && token ? new RedisStore(new Redis({ url, token })) : new MemoryStore();
  return g.__cnStore;
}
