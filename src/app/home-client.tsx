"use client";

import { ArrowRight, Cable, Clock4, Grid3x3, Network, ShieldCheck, Waypoints } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { api, lsSet } from "@/lib/client";
import { formatCode } from "@/lib/format";

export function HomeClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState(() => (params.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ token: string; attempt: { regNo: string; name: string } }>("/api/play/join", {
        body: { code, regNo: reg, name },
      });
      lsSet(`cnwb:session:${code}`, { regNo: res.attempt.regNo, name: res.attempt.name, token: res.token });
      router.push(`/play/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-1 items-start gap-6 px-4 py-10 md:grid-cols-[1fr_380px] md:py-16">
      <section className="rounded-lg border border-line bg-bg-1">
        <div className="border-b border-line px-6 py-5">
          <p className="text-[12px] font-medium text-fg-3">Student</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.015em]">Join your class room</h1>
          <p className="mt-1 text-[13px] text-fg-2">Use the 6-character code on the projector. Your register number is your identity for this quiz.</p>
        </div>
        <form onSubmit={onJoin} className="grid gap-4 px-6 py-6 sm:grid-cols-2">
          <Field label="Room code" className="sm:col-span-2">
            <Input
              mono
              autoFocus={!code}
              value={formatCode(code)}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="K7Q-4MX"
              className="h-12 text-center text-[24px] tracking-[0.2em]"
              autoComplete="off"
              spellCheck={false}
              aria-label="Room code"
            />
          </Field>
          <Field label="Register number">
            <Input
              mono
              autoFocus={!!code}
              value={reg}
              onChange={(e) => setReg(e.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder="RA2311003010123"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="As on the attendance list" autoComplete="name" />
          </Field>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="text-[12px] text-fg-3" role="status" aria-live="polite">
              {error ? <span className="text-bad">{error}</span> : "Rejoining with the same register number resumes your attempt."}
            </p>
            <Button type="submit" variant="primary" size="lg" disabled={busy || code.length !== 6 || reg.length < 6}>
              {busy ? "Joining…" : "Join room"}
              <ArrowRight size={16} strokeWidth={1.5} />
            </Button>
          </div>
        </form>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {[
            { icon: <Grid3x3 size={16} strokeWidth={1.5} />, t: "Bit boards", d: "Masks, CRC, Hamming" },
            { icon: <Waypoints size={16} strokeWidth={1.5} />, t: "Routing", d: "Dijkstra, RIP, LPM" },
            { icon: <Network size={16} strokeWidth={1.5} />, t: "Addressing", d: "VLSM on an address bar" },
            { icon: <Cable size={16} strokeWidth={1.5} />, t: "Protocols", d: "Headers, TCP ladder" },
          ].map((x) => (
            <div key={x.t} className="bg-bg-1 px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-medium text-fg-1">
                <span className="text-fg-3">{x.icon}</span>
                {x.t}
              </div>
              <p className="mt-0.5 text-[12px] text-fg-3">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="rounded-lg border border-line bg-bg-1 px-5 py-4 text-[13px] text-fg-2">
          <ul className="space-y-3">
            <li className="flex gap-3">
              <ShieldCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              <span>The quiz runs in full screen. Leaving full screen or switching tabs is recorded and shown to your teacher.</span>
            </li>
            <li className="flex gap-3">
              <Clock4 size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              <span>Every student gets different values. Time, moves and checks are measured against an expected benchmark.</span>
            </li>
          </ul>
        </section>
      </aside>
    </main>
  );
}
