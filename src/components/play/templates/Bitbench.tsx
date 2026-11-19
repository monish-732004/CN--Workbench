"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { bitsToInt, intToIp } from "@/engine/net";
import { cx, IconButton } from "../../ui";
import { Bit, Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  ip: string;
  ipBits: string;
  maskText: string;
  prefixGiven: number | null;
}
interface Draft {
  prefix: number | null;
  net: string;
  bc: string;
  total: string;
  usable: string;
}

function flip(bits: string, i: number) {
  return bits.slice(0, i) + (bits[i] === "1" ? "0" : "1") + bits.slice(i + 1);
}

function BitRow({ label, bits, prefix, onFlip, readOnly, tone, right }: { label: string; bits: string; prefix: number | null; onFlip?: (i: number) => void; readOnly?: boolean; tone?: "ok" | "bad" | null; right: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[12px] text-fg-2">{label}</span>
      <div className={cx("flex items-center gap-1.5 rounded-md p-1", tone === "ok" && "ring-1 ring-ok", tone === "bad" && "ring-1 ring-bad")}>
        {[0, 1, 2, 3].map((o) => (
          <div key={o} className="flex gap-[2px]">
            {bits
              .slice(o * 8, o * 8 + 8)
              .split("")
              .map((b, j) => {
                const i = o * 8 + j;
                const host = prefix !== null && i >= prefix;
                return (
                  <span key={i} className={cx("relative rounded-sm", host && "bg-signal-bg")}>
                    {prefix === i && i > 0 ? <span className="absolute top-[-6px] bottom-[-6px] -left-[3px] w-[2px] rounded-full bg-signal" /> : null}
                    <Bit value={b} size="xs" readOnly={readOnly} onClick={onFlip ? () => onFlip(i) : undefined} label={`${label} bit ${i + 1}`} />
                  </span>
                );
              })}
          </div>
        ))}
      </div>
      <span className="mono tnum ml-auto w-32 shrink-0 text-right text-[14px] text-fg-1">{right}</span>
    </div>
  );
}

export function BitbenchTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { prefix: v.prefixGiven, net: v.ipBits, bc: v.ipBits, total: "", usable: "", ...(tp.draft ?? {}) };
  if (v.prefixGiven !== null) d.prefix = v.prefixGiven;
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const maskBits = d.prefix === null ? "0".repeat(32) : "1".repeat(d.prefix) + "0".repeat(32 - d.prefix);
  const dotted = (b: string) => intToIp(bitsToInt(b));
  const setPrefix = (p: number) => {
    const np = Math.max(0, Math.min(32, p));
    set({ prefix: np });
    tp.move("boundary", String(np));
  };

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          A host has address <b className="mono">{v.ip}</b> with mask <b className="mono">{v.maskText}</b>. Find the network address and the broadcast address of its block by editing
          the bits, then give the size of the block.
        </Prompt>
      </Card>
      <Card
        title="Bit bench"
        aside={
          v.prefixGiven === null ? (
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[12px] text-fg-3">Prefix boundary</span>
              <IconButton label="Move boundary left" disabled={tp.locked} onClick={() => setPrefix((d.prefix ?? 24) - 1)}>
                <ChevronLeft size={15} strokeWidth={1.5} />
              </IconButton>
              <span className="mono tnum w-10 text-center text-[13px]">{d.prefix === null ? "–" : `/${d.prefix}`}</span>
              <IconButton label="Move boundary right" disabled={tp.locked} onClick={() => setPrefix((d.prefix ?? 23) + 1)}>
                <ChevronRight size={15} strokeWidth={1.5} />
              </IconButton>
            </div>
          ) : (
            <span className="mono text-[12px] text-fg-3">/{v.prefixGiven}</span>
          )
        }
      >
        <div className="canvas-grid overflow-x-auto rounded-md border border-line px-4 py-5">
          <div className="min-w-[720px] space-y-3">
            <BitRow label="Address" bits={v.ipBits} prefix={d.prefix} readOnly right={v.ip} />
            <BitRow label="Mask" bits={maskBits} prefix={d.prefix} readOnly right={d.prefix === null ? "–" : dotted(maskBits)} />
            {v.prefixGiven === null ? (
              <div className="flex items-center gap-3 pl-[92px]">
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={d.prefix ?? 0}
                  disabled={tp.locked}
                  aria-label="Prefix boundary"
                  onChange={(e) => set({ prefix: Number(e.target.value) })}
                  onPointerUp={(e) => tp.move("boundary", (e.target as HTMLInputElement).value)}
                  onKeyUp={(e) => tp.move("boundary", (e.target as HTMLInputElement).value)}
                  className="w-[620px] accent-[var(--signal)]"
                />
              </div>
            ) : null}
            <motion.div layout className="h-px bg-line" />
            <BitRow
              label="Network"
              bits={d.net}
              prefix={d.prefix}
              readOnly={tp.locked}
              onFlip={(i) => {
                const nb = flip(d.net, i);
                set({ net: nb });
                tp.move(`net${i}`, nb[i]);
              }}
              tone={fieldState(tp.verdicts.network, "bits")}
              right={dotted(d.net)}
            />
            <BitRow
              label="Broadcast"
              bits={d.bc}
              prefix={d.prefix}
              readOnly={tp.locked}
              onFlip={(i) => {
                const nb = flip(d.bc, i);
                set({ bc: nb });
                tp.move(`bc${i}`, nb[i]);
              }}
              tone={fieldState(tp.verdicts.broadcast, "bits")}
              right={dotted(d.bc)}
            />
          </div>
        </div>
        <p className="mt-2 text-[12px] text-fg-3">Host bits are shaded once you set the boundary. Click a bit to flip it.</p>
        <div className="mt-3 space-y-3">
          {v.prefixGiven === null ? <CheckpointBar tp={tp} id="boundary" ready={d.prefix !== null} getResponse={() => ({ prefix: d.prefix })} /> : null}
          <CheckpointBar tp={tp} id="network" ready getResponse={() => ({ bits: d.net })} />
          <CheckpointBar tp={tp} id="broadcast" ready getResponse={() => ({ bits: d.bc })} />
        </div>
      </Card>
      <Card title="Block size">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Addresses in the block</span>
            <MonoInput label="Addresses in the block" value={d.total} onChange={(x) => set({ total: x })} onCommit={() => tp.move("total")} state={fieldState(tp.verdicts.counts, "total")} disabled={tp.locked} inputMode="numeric" />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Usable host addresses</span>
            <MonoInput label="Usable host addresses" value={d.usable} onChange={(x) => set({ usable: x })} onCommit={() => tp.move("usable")} state={fieldState(tp.verdicts.counts, "usable")} disabled={tp.locked} inputMode="numeric" />
          </label>
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="counts" ready={!!d.total && !!d.usable} getResponse={() => ({ total: d.total, usable: d.usable })} />
        </div>
      </Card>
    </div>
  );
}
