import { roomPhase, type Room } from "@/engine/model";
import { body, handle } from "@/server/http";
import { hostAction, hostBoard, hostRoom, normCode, roster, storeKind } from "@/server/service";

export const dynamic = "force-dynamic";

function hostView(room: Room) {
  const { hostKeyHash: _h, ...rest } = room;
  const now = Date.now();
  return { ...rest, phase: roomPhase(room, now), serverNow: now };
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const room = await hostRoom(normCode(code), req.headers.get("x-host-key"));
    const [attempts, board] = await Promise.all([roster(room), hostBoard(room)]);
    const points = Object.fromEntries((board.all ?? []).map((r) => [r.reg, { points: r.points, rank: r.rank }]));
    return { room: hostView(room), attempts, storage: storeKind(), board: { ...board, all: undefined }, points };
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const room = await hostRoom(normCode(code), req.headers.get("x-host-key"));
    const updated = await hostAction(room, await body(req));
    return { room: hostView(updated) };
  });
}
