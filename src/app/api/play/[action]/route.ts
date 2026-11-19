import { toRoomPublic } from "@/engine/model";
import { body, handle } from "@/server/http";
import { addEvents, begin, check, chest, HttpError, join, normCode, profile, studentBoard, submit, sync, toPublic } from "@/server/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    const { action } = await ctx.params;
    const b = await body(req);
    const code = normCode(b.code);
    // sendBeacon cannot set headers, so the token may also arrive in the body.
    const tok = req.headers.get("x-attempt-token") ?? (typeof b.token === "string" ? b.token : null);
    const now = () => Date.now();

    if (action === "join") {
      const { attempt, room } = await join(code, b.regNo, b.name, req.headers.get("user-agent") ?? "");
      return { token: attempt.token, attempt: toPublic(attempt), room: toRoomPublic(room, now()) };
    }
    if (action === "state" || action === "sync") {
      const { attempt, room } = await sync(code, b.regNo, tok, b);
      return { attempt: action === "state" ? toPublic(attempt) : undefined, status: attempt.status, room: toRoomPublic(room, now()) };
    }
    if (action === "begin") {
      const { attempt, room } = await begin(code, b.regNo, tok);
      return { attempt: toPublic(attempt), room: toRoomPublic(room, now()) };
    }
    if (action === "events") {
      const { room } = await addEvents(code, b.regNo, tok, b.events);
      return { ok: true, room: toRoomPublic(room, now()) };
    }
    if (action === "check") {
      const { verdict } = await check(code, b.regNo, tok, b);
      return { verdict };
    }
    if (action === "chest") return chest(code, b.regNo, tok, b);
    if (action === "board") return studentBoard(code, b.regNo, tok);
    if (action === "profile") {
      const { attempt } = await profile(code, b.regNo, tok, b);
      return { attempt: toPublic(attempt) };
    }
    if (action === "submit") {
      const { attempt, room } = await submit(code, b.regNo, tok, b);
      return { attempt: toPublic(attempt), room: toRoomPublic(room, now()) };
    }
    throw new HttpError(404, "Unknown action.");
  });
}
