"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

/** Runs requests one at a time, so a student's writes never race each other. */
export function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

// ───────── local storage (guarded: private windows can throw) ─────────
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function lsDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface HostRoomRef {
  code: string;
  hostKey: string;
  title: string;
  section: string;
  createdAt: number;
}

export const HOST_ROOMS_KEY = "cnwb:hostRooms";

export function hostRooms(): HostRoomRef[] {
  return lsGet<HostRoomRef[]>(HOST_ROOMS_KEY, []);
}

export function hostKeyFor(code: string): string | null {
  return hostRooms().find((r) => r.code === code)?.hostKey ?? null;
}

export function rememberHostRoom(ref: HostRoomRef) {
  const list = hostRooms().filter((r) => r.code !== ref.code);
  list.unshift(ref);
  lsSet(HOST_ROOMS_KEY, list.slice(0, 60));
}

export function forgetHostRoom(code: string) {
  lsSet(
    HOST_ROOMS_KEY,
    hostRooms().filter((r) => r.code !== code),
  );
}
