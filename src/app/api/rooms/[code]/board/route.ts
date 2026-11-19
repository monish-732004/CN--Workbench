import { roomPhase } from "@/engine/model";
import { sha256, safeEqual } from "@/server/crypto";
import { handle } from "@/server/http";
import { getRoom, normCode, publicBoard } from "@/server/service";

export const dynamic = "force-dynamic";

/** Leaderboard for the projector. Needs the host key when the teacher hides the board from students. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const room = await getRoom(normCode(code));
    const key = req.headers.get("x-host-key");
    const isHost = !!key && safeEqual(sha256(key), room.hostKeyHash);
    const board = await publicBoard(room, isHost);
    return { ...board, phase: roomPhase(room, Date.now()), title: room.title, section: room.section };
  });
}
