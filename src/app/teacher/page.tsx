"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/chrome";
import { Button, EmptyState, IconButton, Tag } from "@/components/ui";
import type { RoomPublic } from "@/engine/model";
import { api, forgetHostRoom, hostRooms, type HostRoomRef } from "@/lib/client";
import { formatCode } from "@/lib/format";

const PHASE_TAG: Record<string, { tone: "ok" | "warn" | "neutral" | "signal"; label: string }> = {
  waiting: { tone: "neutral", label: "Not started" },
  live: { tone: "ok", label: "Live" },
  grace: { tone: "warn", label: "Grace period" },
  closed: { tone: "neutral", label: "Closed" },
};

export default function TeacherHome() {
  const [rooms, setRooms] = useState<HostRoomRef[] | null>(null);
  const [status, setStatus] = useState<Record<string, RoomPublic | "missing">>({});

  useEffect(() => {
    const list = hostRooms();
    setRooms(list);
    list.slice(0, 20).forEach((r) =>
      api<RoomPublic>(`/api/rooms/${r.code}`)
        .then((p) => setStatus((s) => ({ ...s, [r.code]: p })))
        .catch(() => setStatus((s) => ({ ...s, [r.code]: "missing" }))),
    );
  }, []);

  return (
    <div className="min-h-dvh">
      <TopBar>
        <span className="text-[13px] text-fg-3">/</span>
        <span className="text-[13px] font-medium">Teacher console</span>
      </TopBar>
      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Rooms</h1>
            <p className="mt-0.5 text-[13px] text-fg-2">Rooms created on this browser. The host key stays on this device.</p>
          </div>
          <Link href="/teacher/new">
            <Button variant="primary">
              <Plus size={15} strokeWidth={1.75} /> New room
            </Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-bg-1">
          {rooms === null ? null : rooms.length === 0 ? (
            <EmptyState
              action={
                <Link href="/teacher/new">
                  <Button variant="secondary">Create your first room</Button>
                </Link>
              }
            >
              No rooms yet.
            </EmptyState>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-strong text-left text-[11px] font-medium text-fg-2">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Section</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const st = status[r.code];
                  const tag = st === "missing" ? { tone: "neutral" as const, label: "Expired" } : st ? PHASE_TAG[st.phase] : null;
                  return (
                    <tr key={r.code} className="group border-b border-line last:border-b-0 hover:bg-bg-3/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/teacher/room/${r.code}`} className="mono tnum font-medium text-fg-1 hover:text-signal">
                          {formatCode(r.code)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{r.title}</td>
                      <td className="px-4 py-2.5 text-fg-2">{r.section || "–"}</td>
                      <td className="tnum px-4 py-2.5 text-fg-2">{new Date(r.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2.5">{tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : <span className="text-fg-3">…</span>}</td>
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label="Remove from this list"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              forgetHostRoom(r.code);
                              setRooms(hostRooms());
                            }}
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </IconButton>
                          <Link href={`/teacher/room/${r.code}`} aria-label="Open">
                            <IconButton label="Open room">
                              <ArrowRight size={15} strokeWidth={1.5} />
                            </IconButton>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
