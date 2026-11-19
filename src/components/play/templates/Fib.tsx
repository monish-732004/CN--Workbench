"use client";

import { Ban, Send } from "lucide-react";
import { motion } from "motion/react";
import { ipToInt, toBits } from "@/engine/net";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Prompt, type TplProps } from "../kit";

interface View {
  routes: { prefix: string; iface: string; nextHop: string | null }[];
  packets: string[];
  ifaces: string[];
  hasDefault: boolean;
}
interface Draft {
  out: (string | null)[];
  selected: number | null;
}

export function FibTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { out: v.packets.map(() => null), selected: 0, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const assign = (target: string) => {
    if (d.selected === null || tp.locked) return;
    const out = d.out.slice();
    out[d.selected] = target;
    const nextUnassigned = out.findIndex((x, i) => x === null && i !== d.selected);
    set({ out, selected: nextUnassigned >= 0 ? nextUnassigned : null });
    tp.move(`pkt${d.selected}`, target);
  };
  const selIp = d.selected !== null ? v.packets[d.selected] : null;

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Router <b>R1</b> receives the packets below. Using its forwarding table, send each packet out of the correct interface. {v.hasDefault ? "" : "There is no default route: drop a packet that matches nothing."}{" "}
          The table is <i>not</i> sorted.
        </Prompt>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card title="Forwarding table · R1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 pr-3 font-medium">Network / mask</th>
                <th className="py-1.5 pr-3 font-medium">Next hop</th>
                <th className="py-1.5 font-medium">Interface</th>
              </tr>
            </thead>
            <tbody>
              {v.routes.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  <td className="mono tnum py-2 pr-3">{r.prefix === "0.0.0.0/0" ? <span>0.0.0.0/0 <span className="text-fg-3">(default)</span></span> : r.prefix}</td>
                  <td className="mono tnum py-2 pr-3 text-fg-2">{r.nextHop ?? "directly connected"}</td>
                  <td className="mono py-2">{r.iface}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selIp ? (
            <div className="mt-4 rounded-md border border-line bg-bg-2 px-3 py-2">
              <p className="text-[11px] text-fg-3">Destination of the selected packet in binary</p>
              <p className="mono tnum mt-0.5 text-[13px] tracking-wide text-fg-1">{toBits(ipToInt(selIp)).replace(/(.{8})(?=.)/g, "$1 ")}</p>
            </div>
          ) : null}
        </Card>

        <Card title="Packets">
          <div className="canvas-grid rounded-md border border-line p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {v.packets.map((ip, i) => {
                const sel = d.selected === i;
                const st = fieldState(tp.verdicts.forward, `p${i + 1}`);
                return (
                  <motion.button
                    layout
                    type="button"
                    key={i}
                    disabled={tp.locked}
                    onClick={() => set({ selected: sel ? null : i })}
                    className={cx(
                      "flex items-center justify-between gap-2 rounded-md border bg-bg-1 px-3 py-2 text-left transition-colors",
                      sel ? "border-signal ring-1 ring-signal" : "border-line hover:border-line-strong",
                      st === "ok" && "border-ok",
                      st === "bad" && "border-bad",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] text-fg-3">Packet {i + 1} · destination</span>
                      <span className="mono tnum block text-[14px]">{ip}</span>
                    </span>
                    {d.out[i] ? (
                      <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cx("mono inline-flex h-6 items-center rounded-sm border px-1.5 text-[11px]", d.out[i] === "drop" ? "border-bad/35 bg-bad-bg text-bad" : "border-line bg-bg-3 text-fg-1")}>
                        {d.out[i] === "drop" ? "Drop" : d.out[i]}
                      </motion.span>
                    ) : (
                      <span className="text-[11px] text-fg-3">unassigned</span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div className="flex flex-wrap justify-center gap-2">
                {v.ifaces.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={d.selected === null || tp.locked}
                    onClick={() => assign(f)}
                    className="mono inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-bg-1 px-2.5 text-[12px] transition-colors hover:border-signal hover:bg-signal-bg disabled:opacity-50"
                  >
                    <Send size={12} strokeWidth={1.5} className="text-fg-3" />
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={d.selected === null || tp.locked}
                  onClick={() => assign("drop")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-bad/40 bg-bg-1 px-2.5 text-[12px] text-bad transition-colors hover:bg-bad-bg disabled:opacity-50"
                >
                  <Ban size={12} strokeWidth={1.5} /> Drop
                </button>
              </div>
              <svg width="120" height="64" viewBox="0 0 120 64" className="mt-3 text-fg-2" aria-hidden>
                <ellipse cx="60" cy="34" rx="34" ry="18" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.5" />
                <path d="M44 34h10m12 0h10M60 22v6m0 12v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M51 31l3 3-3 3M69 31l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] text-fg-3">{d.selected !== null ? `Packet ${d.selected + 1} selected: choose an interface` : "Select a packet"}</span>
            </div>
          </div>
          <div className="mt-4">
            <CheckpointBar tp={tp} id="forward" ready={d.out.every(Boolean)} getResponse={() => ({ out: d.out })} />
          </div>
        </Card>
      </div>
    </div>
  );
}
