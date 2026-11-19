import { body, handle } from "@/server/http";
import { createRoom } from "@/server/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => createRoom(await body(req)));
}
