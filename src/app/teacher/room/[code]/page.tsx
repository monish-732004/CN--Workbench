import type { Metadata } from "next";
import { RoomClient } from "@/components/teacher/RoomClient";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase().replace(/[^A-Z0-9]/g, "")} />;
}
