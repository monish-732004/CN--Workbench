import type { Metadata } from "next";
import { PlayClient } from "@/components/play/PlayClient";

export const metadata: Metadata = { title: "Quiz" };

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayClient code={code.toUpperCase().replace(/[^A-Z0-9]/g, "")} />;
}
