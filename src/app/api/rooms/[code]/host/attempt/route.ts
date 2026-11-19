import { handle } from "@/server/http";
import { attemptDetail, hostRoom, normCode } from "@/server/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const room = await hostRoom(normCode(code), req.headers.get("x-host-key"));
    const reg = new URL(req.url).searchParams.get("reg");
    return attemptDetail(room, reg);
  });
}
