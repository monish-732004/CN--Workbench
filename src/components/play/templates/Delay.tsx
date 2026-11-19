"use client";

import { motion } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Given, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  distanceKm: number;
  speed: string;
  medium: string;
  size: string;
  bandwidth: string;
  queueMs: number;
  procMs: number;
  withQueue: boolean;
  withBdp: boolean;
}
interface Draft {
  prop: string;
  tx: string;
  total: string;
  dominant: string;
  bdp: string;
}
const EMPTY: Draft = { prop: "", tx: "", total: "", dominant: "", bdp: "" };

const SEGMENTS = [
  { id: "propagation", label: "Propagation", color: "var(--cat-1)" },
  { id: "transmission", label: "Transmission", color: "var(--cat-2)" },
  { id: "queuing", label: "Queuing", color: "var(--cat-3)" },
  { id: "processing", label: "Processing", color: "var(--cat-4)" },
] as const;

const n = (s: string) => {
  const v = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

export function DelayTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d = { ...EMPTY, ...(tp.draft ?? {}) };
  const set = (k: keyof Draft, val: string) => tp.setDraft({ ...d, [k]: val });
  const commit = (k: string) => () => tp.move(k);
  const values: Record<string, number> = {
    propagation: n(d.prop),
    transmission: n(d.tx),
    queuing: v.withQueue ? v.queueMs : 0,
    processing: v.withQueue ? v.procMs : 0,
  };
  const sum = Object.values(values).reduce((a, b) => a + b, 0);
  const vd = tp.verdicts;

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          A <b className="mono">{v.size}</b> message travels <b className="mono">{v.distanceKm.toLocaleString("en-IN")} km</b> through {v.medium} on a{" "}
          <b className="mono">{v.bandwidth}</b> link. Work out how long it takes until the <i>last bit</i> arrives. Enter times in <b>milliseconds</b>.
        </Prompt>
        <div className="mt-4 rounded-md border border-line bg-bg-2 px-4 py-3">
          <Given
            items={[
              { k: "Distance", v: `${v.distanceKm.toLocaleString("en-IN")} km` },
              { k: "Propagation speed", v: v.speed },
              { k: "Message size", v: `${v.size} (1 KB = 1000 B)` },
              { k: "Bandwidth", v: v.bandwidth },
              ...(v.withQueue
                ? [
                    { k: "Queuing delay", v: `${v.queueMs} ms` },
                    { k: "Processing delay", v: `${v.procMs} ms` },
                  ]
                : []),
            ]}
          />
        </div>
      </Card>

      <Card title="Latency timeline" aside={<span className="mono tnum text-[12px] text-fg-3">0 → {sum ? `${+sum.toFixed(3)} ms` : "?"}</span>}>
        <div className="canvas-grid rounded-md border border-line p-4">
          <div className="flex h-12 w-full overflow-hidden rounded-sm border border-line-strong bg-bg-1">
            {SEGMENTS.map((s) => {
              const w = sum > 0 ? (values[s.id]! / sum) * 100 : 25;
              const chosen = d.dominant === s.id;
              if (!v.withQueue && (s.id === "queuing" || s.id === "processing")) return null;
              return (
                <motion.button
                  type="button"
                  key={s.id}
                  disabled={tp.locked}
                  onClick={() => {
                    set("dominant", s.id);
                    tp.move("dominant", s.id);
                  }}
                  initial={false}
                  animate={{ width: `${Math.max(w, sum > 0 && values[s.id]! > 0 ? 1.5 : 0.0001)}%` }}
                  transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                  className={cx("relative h-full min-w-0 border-r border-bg-1 text-left transition-[filter] last:border-r-0 hover:brightness-110", chosen && "ring-2 ring-inset ring-signal")}
                  style={{ background: s.color, opacity: sum > 0 ? 0.85 : 0.25 }}
                  title={`${s.label}: ${values[s.id]} ms. Click to mark as dominant.`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {SEGMENTS.filter((s) => v.withQueue || (s.id !== "queuing" && s.id !== "processing")).map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-[12px] text-fg-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
                <span className="mono tnum text-fg-3">{values[s.id] ? `${+values[s.id]!.toFixed(3)} ms` : "–"}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-fg-3">The bar is drawn from your values. Click the segment that dominates the latency.</p>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Propagation time</span>
            <span className="flex items-center gap-2">
              <MonoInput label="Propagation time in ms" value={d.prop} onChange={(x) => set("prop", x)} onCommit={commit("prop")} placeholder="0.000" state={fieldState(vd.delays, "prop")} disabled={tp.locked} inputMode="decimal" />
              <span className="text-[12px] text-fg-3">ms</span>
            </span>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Transmission time</span>
            <span className="flex items-center gap-2">
              <MonoInput label="Transmission time in ms" value={d.tx} onChange={(x) => set("tx", x)} onCommit={commit("tx")} placeholder="0.000" state={fieldState(vd.delays, "tx")} disabled={tp.locked} inputMode="decimal" />
              <span className="text-[12px] text-fg-3">ms</span>
            </span>
          </label>
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="delays" ready={!!d.prop && !!d.tx} getResponse={() => ({ prop: d.prop, tx: d.tx })} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[13px] text-fg-2">Total latency</span>
          <span className="flex items-center gap-2">
            <MonoInput label="Total latency in ms" value={d.total} onChange={(x) => set("total", x)} onCommit={commit("total")} placeholder="0.000" state={fieldState(vd.total, "total")} disabled={tp.locked} inputMode="decimal" />
            <span className="text-[12px] text-fg-3">ms</span>
          </span>
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="total" ready={!!d.total} getResponse={() => ({ total: d.total })} />
        </div>
        <div className="mt-4">
          <CheckpointBar
            tp={tp}
            id="dominant"
            ready={!!d.dominant}
            getResponse={() => ({ dominant: d.dominant })}
            hint={d.dominant ? `Selected: ${d.dominant}` : "Click a segment on the timeline"}
          />
        </div>
        {v.withBdp ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg-2">Bits in flight (bandwidth × propagation delay)</span>
              <span className="flex items-center gap-2">
                <MonoInput label="Bandwidth delay product in bits" value={d.bdp} onChange={(x) => set("bdp", x)} onCommit={commit("bdp")} placeholder="0" state={fieldState(vd.bdp, "bdp")} disabled={tp.locked} inputMode="numeric" />
                <span className="text-[12px] text-fg-3">bits</span>
              </span>
            </div>
            <div className="mt-4">
              <CheckpointBar tp={tp} id="bdp" ready={!!d.bdp} getResponse={() => ({ bdp: d.bdp })} />
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
