import { toRoomPublic } from "@/engine/model";
import { handle } from "@/server/http";
import { getRoom, normCode } from "@/server/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const room = await getRoom(normCode(code));
    return toRoomPublic(room, Date.now());
  });
}
