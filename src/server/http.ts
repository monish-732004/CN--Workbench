import { NextResponse } from "next/server";
import { HttpError } from "./service";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handle(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server. Try again." }, 500);
  }
}

export async function body(req: Request): Promise<any> {
  try {
    const text = await req.text();
    if (text.length > 200_000) throw new HttpError(413, "Request too large.");
    return text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON.");
  }
}
