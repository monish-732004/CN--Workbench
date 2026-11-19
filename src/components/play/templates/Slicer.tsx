"use client";

import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { intToIp, ipToInt } from "@/engine/net";
import { Button, cx } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface Req {
  id: string;
  label: string;
  hosts: number;
}
interface View {
  parent: string;
  parentPrefix: number;
  parentSize: number;
  reqs: Req[];
}
interface Draft {
  prefixes: Record<string, number>;
  blocks: Record<string, { offset: number; prefix: number }>;
  ranges: Record<string, { first: string; last: string; broadcast: string }>;
  selected: string | null;
}

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-1)", "var(--cat-2)"];
const GRID = 4;

export function SlicerTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { prefixes: {}, blocks: {}, ranges: {}, selected: null, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const parentInt = ipToInt(v.parent);
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const colorOf = (id: string) => CATS[v.reqs.findIndex((r) => r.id === id) % CATS.length]!;
  const sizeOf = (p: number) => 2 ** (32 - p);

  const stepPrefix = (id: string, delta: number) => {
    const cur = d.prefixes[id] ?? (delta > 0 ? v.parentPrefix : 31);
    const np = Math.max(v.parentPrefix + 1, Math.min(30, cur + delta));
    const blocks = { ...d.blocks };
    if (blocks[id]) blocks[id] = { ...blocks[id]!, prefix: np };
    set({ prefixes: { ...d.prefixes, [id]: np }, blocks });
    tp.move(`prefix:${id}`, String(np));
  };

  const offsetAt = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.floor((frac * v.parentSize) / GRID) * GRID;
  };

  const sel = d.selected;
  const selPrefix = sel ? d.prefixes[sel] : undefined;

  const place = (clientX: number) => {
    if (!sel || selPrefix === undefined || tp.locked) return;
    const size = sizeOf(selPrefix);
    const offset = Math.min(offsetAt(clientX), v.parentSize - size);
    set({ blocks: { ...d.blocks, [sel]: { offset, prefix: selPrefix } }, selected: null });
    tp.move(`place:${sel}`, String(offset));
  };

  const ticks = 8;
  const allSized = v.reqs.every((r) => d.prefixes[r.id] !== undefined);
  const allPlaced = v.reqs.every((r) => d.blocks[r.id]);
  const allRanges = v.reqs.every((r) => d.ranges[r.id]?.first && d.ranges[r.id]?.last && d.ranges[r.id]?.broadcast);
  const blocksResp = () => ({ blocks: Object.fromEntries(v.reqs.map((r) => [r.id, d.blocks[r.id] ? { offset: d.blocks[r.id]!.offset, prefix: d.prefixes[r.id] ?? d.blocks[r.id]!.prefix } : null])) });

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Plan <b className="mono">{v.parent}/{v.parentPrefix}</b> with VLSM. Give each network the smallest block that fits its hosts, allocate the largest first from the lowest free
          address, and fill in each subnet&apos;s host range. WAN links need 2 hosts.
        </Prompt>
      </Card>

      <Card title="Address space" aside={<span className="mono tnum text-[12px] text-fg-3">{v.parentSize.toLocaleString("en-IN")} addresses</span>}>
        <div className="canvas-grid rounded-md border border-line px-4 pt-4 pb-2">
          <div
            ref={barRef}
            className={cx("relative h-14 rounded-sm border border-line-strong bg-bg-1", sel && selPrefix !== undefined ? "cursor-crosshair" : "cursor-default")}
            onMouseMove={(e) => setHover(sel && selPrefix !== undefined ? offsetAt(e.clientX) : null)}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => place(e.clientX)}
            role="application"
            aria-label="Address bar. Select a requirement, then click where its block should start."
          >
            {Array.from({ length: ticks - 1 }, (_, i) => (
              <span key={i} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${((i + 1) / ticks) * 100}%` }} />
            ))}
            <AnimatePresence>
              {v.reqs.map((r) => {
                const b = d.blocks[r.id];
                if (!b) return null;
                const p = d.prefixes[r.id] ?? b.prefix;
                const w = (sizeOf(p) / v.parentSize) * 100;
                return (
                  <motion.button
                    type="button"
                    key={r.id}
                    initial={{ opacity: 0, scaleY: 0.6 }}
                    animate={{ opacity: 1, scaleY: 1, left: `${(b.offset / v.parentSize) * 100}%`, width: `${w}%` }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!tp.locked) set({ selected: r.id });
                    }}
                    className="absolute top-1 bottom-1 overflow-hidden rounded-[3px] border border-black/10 px-1 text-left"
                    style={{ background: colorOf(r.id), minWidth: 3 }}
                    title={`${r.label} · /${p} at ${intToIp(parentInt + b.offset)}`}
                  >
                    <span className="block truncate text-[11px] font-medium text-bg-0">{r.label}</span>
                    <span className="mono block truncate text-[10px] text-bg-0/80">/{p}</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {hover !== null && sel && selPrefix !== undefined ? (
              <span
                className="pointer-events-none absolute top-1 bottom-1 rounded-[3px] border border-dashed border-signal bg-signal-bg"
                style={{ left: `${(Math.min(hover, v.parentSize - sizeOf(selPrefix)) / v.parentSize) * 100}%`, width: `${(sizeOf(selPrefix) / v.parentSize) * 100}%`, minWidth: 3 }}
              />
            ) : null}
          </div>
          <div className="relative mt-1 h-5">
            {Array.from({ length: ticks + 1 }, (_, i) => {
              const off = (v.parentSize / ticks) * i;
              const ip = intToIp(parentInt + Math.min(off, v.parentSize - 1) + (i === ticks ? 1 : 0));
              const parts = ip.split(".");
              return (
                <span key={i} className="mono tnum absolute -translate-x-1/2 text-[10px] text-fg-3" style={{ left: `${(i / ticks) * 100}%` }}>
                  {i === ticks ? `+${v.parentSize}` : `.${parts.slice(v.parentPrefix >= 24 ? 3 : 2).join(".")}`}
                </span>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-fg-3">
          {sel ? (selPrefix === undefined ? "Set a prefix for this requirement first." : `Click the bar to place ${v.reqs.find((r) => r.id === sel)?.label} (/${selPrefix}). Blocks snap to 4-address steps.`) : "Select a requirement below, then click on the bar to place its block."}
        </p>
      </Card>

      <Card title="Requirements">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-2 pr-3 font-medium">Network</th>
                <th className="py-2 pr-3 text-right font-medium">Hosts</th>
                <th className="py-2 pr-3 font-medium">Prefix</th>
                <th className="py-2 pr-3 font-medium">Placed at</th>
                <th className="py-2 pr-3 font-medium">First host</th>
                <th className="py-2 pr-3 font-medium">Last host</th>
                <th className="py-2 pr-3 font-medium">Broadcast</th>
              </tr>
            </thead>
            <tbody>
              {v.reqs.map((r) => {
                const p = d.prefixes[r.id];
                const b = d.blocks[r.id];
                const rg = d.ranges[r.id] ?? { first: "", last: "", broadcast: "" };
                const setR = (k: "first" | "last" | "broadcast", x: string) => set({ ranges: { ...d.ranges, [r.id]: { ...rg, [k]: x } } });
                return (
                  <tr key={r.id} className={cx("border-b border-line last:border-b-0", sel === r.id && "bg-signal-bg")}>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(r.id) }} />
                        {r.label}
                      </span>
                    </td>
                    <td className="mono tnum py-2 pr-3 text-right">{r.hosts}</td>
                    <td className="py-2 pr-3">
                      <span className={cx("inline-flex items-center rounded-md border", fieldState(tp.verdicts.sizing, r.id) === "bad" ? "border-bad" : fieldState(tp.verdicts.sizing, r.id) === "ok" ? "border-ok" : "border-line-strong")}>
                        <button type="button" aria-label="Larger block" disabled={tp.locked} onClick={() => stepPrefix(r.id, -1)} className="flex h-7 w-7 items-center justify-center text-fg-2 hover:text-fg-1">
                          <Minus size={13} strokeWidth={1.5} />
                        </button>
                        <span className="mono tnum w-9 text-center">{p === undefined ? "–" : `/${p}`}</span>
                        <button type="button" aria-label="Smaller block" disabled={tp.locked} onClick={() => stepPrefix(r.id, 1)} className="flex h-7 w-7 items-center justify-center text-fg-2 hover:text-fg-1">
                          <Plus size={13} strokeWidth={1.5} />
                        </button>
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {b ? (
                        <span className="inline-flex items-center gap-1">
                          <button type="button" className="mono tnum text-fg-1 hover:text-signal" onClick={() => set({ selected: r.id })} disabled={tp.locked}>
                            {intToIp(parentInt + b.offset)}
                          </button>
                          <button
                            type="button"
                            aria-label="Remove block"
                            disabled={tp.locked}
                            className="text-fg-3 hover:text-bad"
                            onClick={() => {
                              const blocks = { ...d.blocks };
                              delete blocks[r.id];
                              set({ blocks });
                              tp.move(`place:${r.id}`, "none");
                            }}
                          >
                            <X size={13} strokeWidth={1.5} />
                          </button>
                        </span>
                      ) : (
                        <Button size="sm" variant={sel === r.id ? "signal" : "secondary"} disabled={tp.locked || p === undefined} onClick={() => set({ selected: sel === r.id ? null : r.id })}>
                          {sel === r.id ? "Click the bar" : "Place"}
                        </Button>
                      )}
                    </td>
                    {(["first", "last", "broadcast"] as const).map((k) => (
                      <td key={k} className="py-2 pr-3">
                        <MonoInput
                          label={`${r.label} ${k}`}
                          value={rg[k]}
                          onChange={(x) => setR(k, x)}
                          onCommit={() => tp.move(`${k}:${r.id}`)}
                          placeholder="a.b.c.d"
                          width="w-[132px]"
                          state={fieldState(tp.verdicts.ranges, `${r.id}.${k}`)}
                          disabled={tp.locked}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3">
          <CheckpointBar tp={tp} id="sizing" ready={allSized} getResponse={() => ({ prefixes: d.prefixes })} />
          <CheckpointBar tp={tp} id="placement" ready={allPlaced && allSized} getResponse={blocksResp} />
          <CheckpointBar tp={tp} id="ranges" ready={allRanges && allPlaced} getResponse={() => ({ ...blocksResp(), ranges: d.ranges })} />
        </div>
      </Card>
    </div>
  );
}
